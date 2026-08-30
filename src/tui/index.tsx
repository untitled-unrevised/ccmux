import { render } from "@opentui/solid";
import {
  CliRenderEvents,
  createCliRenderer,
  type CliRenderer,
  type CliRendererConfig,
} from "@opentui/core";
import { App } from "./App";
import type { IconStyle } from "../lib/icons";
import type {
  ColumnsConfig,
  BreakpointConfig,
  PromptDisplay,
  ThemeConfig,
  Preferences,
} from "../lib/preferences";
import { applyTheme } from "./theme";
import type { GroupBy } from "./utils/grouping";
import { PERF_ENABLED } from "./utils/perf";
import { findRestorePane, refreshClient, selectPane } from "./utils/tmux";
import { markStartup } from "../lib/startup-timing";

interface TUIOptions {
  initialPreview?: boolean;
  iconStyle?: IconStyle;
  previewWidth?: number;
  columns?: ColumnsConfig;
  breakpoints?: BreakpointConfig;
  searchPaneContent?: boolean;
  searchPaneLines?: number;
  searchTranscript?: boolean;
  groupBy?: GroupBy;
  collapsedGroups?: string[];
  pinnedGroups?: string[];
  hideIdle?: boolean;
  promptDisplay?: PromptDisplay;
  persistent?: boolean;
  sidebar?: boolean;
  lastSpawnAgent?: string;
  theme?: ThemeConfig;
  reviewHandback?: Preferences["reviewHandback"];
  forkableAgents?: string[];
}

/** Quiet-period after the last CAPABILITIES event before we restore focus.
 * Probe replies trickle in over a few ms; a single CAPABILITIES event isn't
 * enough. Debouncing on the last one ensures all replies have been consumed
 * before we hand focus back. */
const CAPABILITY_QUIET_MS = 250;
/** Hard ceiling: if probe replies never settle (terminal dropped them),
 * restore focus anyway so we don't leave the user stranded in the sidebar. */
const CAPABILITY_HARD_CAP_MS = 5000;

/**
 * A persistent sidebar is drawn beside a real application pane. On VTE, an
 * alternate-screen transition from that narrow pane can leave pixels from the
 * pre-split full-width frame visible until tmux next repaints the client.
 *
 * Sidebars have no scrollback to preserve when they exit (the pane is killed),
 * so they run on their main screen. The two client redraws cover both the
 * initial OpenTUI frame and the delayed capability-probe frame without making
 * the long-lived renderer redraw continuously.
 */
function repairSidebarClientFrame(): void {
  for (const delay of [100, 350]) {
    setTimeout(() => {
      void refreshClient();
    }, delay);
  }
}

/**
 * When the sidebar spawns into an unfocused pane (via `--toggle` or the
 * `after-new-window` hook's `split-window -d`), OpenTUI's terminal-
 * capability probes get sent through tmux DCS passthrough, but tmux routes
 * the replies to the focused pane (i.e. the user's shell), where they
 * echo as gibberish.
 *
 * Dance: steal focus to ourselves before probes fire, let OpenTUI consume
 * the replies, then restore focus once CAPABILITIES events quiesce.
 */
function arrangeSidebarFocusDance(
  renderer: CliRenderer,
  restoreTarget: string,
): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void selectPane(restoreTarget);
  };

  renderer.on(CliRenderEvents.CAPABILITIES, () => {
    if (restored) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(restore, CAPABILITY_QUIET_MS);
  });

  setTimeout(restore, CAPABILITY_HARD_CAP_MS);
}

export async function launchTUI(options: TUIOptions = {}): Promise<void> {
  markStartup("render_start");

  // Alternate-screen mode is correct for the full picker, but a sidebar is a
  // persistent tmux neighbour. Keeping it on the pane's main screen prevents
  // a VTE stale-frame bleed into the adjacent agent pane. OpenTUI exposes this
  // per-process choice through its documented environment switch; every
  // sidebar is its own process, so this cannot change a picker or an agent.
  if (options.sidebar) process.env.OTUI_USE_ALTERNATE_SCREEN = "false";

  // Resolve the theme into the live singleton before any component renders.
  // Launch-time only: no in-TUI toggle, no reactivity.
  applyTheme(options.theme);

  const config: CliRendererConfig = {
    useMouse: true,
    gatherStats: PERF_ENABLED,
  };

  // Sidebar spawned via -d into an unfocused pane needs the focus dance
  // to keep terminal capability probe replies from leaking into the
  // user's shell. Focus must be stolen before the renderer exists, since
  // creating it fires the probes. Picker/non-sidebar TUIs run in the
  // user's own focused pane, so the dance is a no-op there.
  let restoreTarget: string | null = null;
  if (options.sidebar && process.env.TMUX_PANE) {
    restoreTarget = await findRestorePane();
    if (restoreTarget) {
      await selectPane(process.env.TMUX_PANE);
    }
  }

  const renderer = await createCliRenderer(config);
  if (options.sidebar) repairSidebarClientFrame();
  if (restoreTarget) {
    arrangeSidebarFocusDance(renderer, restoreTarget);
  }

  // Quit paths exit via process.exit(), which skips OpenTUI's `beforeExit`
  // cleanup (its signal handlers do fire, but `process.exit` emits only
  // `exit`), leaving mouse tracking and the alternate screen armed on the
  // host terminal (issue #125). destroy() is idempotent, so it is safe here
  // even when a signal-driven destroy already ran, and it restores the
  // terminal synchronously as long as no frame callback awaits real I/O
  // (destroy() during a live render pass defers the restore to the render
  // loop, which never resumes once process.exit is in flight). The catch
  // matters: destroy() runs every Solid onCleanup before the native restore,
  // and a throw there would skip the restore and reinstate #125.
  process.on("exit", () => {
    try {
      renderer.destroy();
    } catch {}
  });

  await render(
    () => (
      <App
        initialPreview={options.initialPreview}
        iconStyle={options.iconStyle}
        previewWidth={options.previewWidth}
        columns={options.columns}
        breakpoints={options.breakpoints}
        searchPaneContent={options.searchPaneContent}
        searchPaneLines={options.searchPaneLines}
        searchTranscript={options.searchTranscript}
        groupBy={options.groupBy}
        collapsedGroups={options.collapsedGroups}
        pinnedGroups={options.pinnedGroups}
        hideIdle={options.hideIdle}
        promptDisplay={options.promptDisplay}
        persistent={options.persistent}
        sidebar={options.sidebar}
        lastSpawnAgent={options.lastSpawnAgent}
        reviewHandback={options.reviewHandback}
        forkableAgents={options.forkableAgents}
      />
    ),
    renderer,
  );
}
