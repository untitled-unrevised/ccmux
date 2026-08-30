# ccmux — personal fork

This is a **personal fork** of [epilande/ccmux](https://github.com/epilande/ccmux),
maintained for my own use. Upstream owns the project; this repo only exists
to carry a small set of local TUI tweaks that I haven't (and probably won't)
send back as a PR.

**If you want ccmux, install upstream.** Don't rely on this mirror — I
make no guarantees about stability, support, or even that the local
changes will keep working against future upstream releases. The whole
point of a personal fork is that it's for one person.

---

## Upstream

- **Project:** <https://github.com/epilande/ccmux>
- **Author:** epilande
- **License:** same as upstream (see `LICENSE`)
- **Version this fork was forked from:** v1.3.2 (upstream commit `ebb0e29`)

The `origin` remote in this clone still points at the upstream repo, so
`git fetch origin` works to pull in new upstream commits. The `untitled-unrevised`
remote points at this fork's mirror on GitHub and is what `main` tracks by
default — so `git push` from this clone goes to the personal mirror, not
upstream. I have no intention of pushing anything from here back to
`epilande/ccmux`.

## What's in here that's not in upstream

All local changes are in a single commit on top of `ebb0e29`:

```
Personal fork: local TUI tweaks (preview focus, sidebar redraw repair)
```

(After being mirrored to GitHub, the SHA changes because the CI workflow
files were stripped on push — see "Known differences" below. The local
clone's commit SHA is the one referenced by anything I write about this
fork.)

The commit's diff is small enough to read in one sitting:

| File                              | What changed                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `src/tui/components/Preview.tsx`  | New `immersive` prop: drops the left border when the preview owns the whole work surface (focus mode), so the border doesn't sit next to the session list. |
| `src/tui/index.tsx` + `src/tui/App.tsx` | Persistent sidebars run on the pane's main screen (`OTUI_USE_ALTERNATE_SCREEN=false`) and force two client redraws to cover the VTE stale-frame bleed that an alt-screen transition from a narrow pane otherwise leaves visible. |
| `src/tui/utils/tmux.ts` (+ tests) | New `refreshClient()` helper that asks tmux to redraw the current client. Used by the sidebar repair above; kept in the public surface in case other call sites need it. |
| `src/tui/components/Footer.tsx` (+ tests) | Key hints rebalanced by rank so the `q quit` hint survives a narrowing terminal. The default line grew past 120 cols after `n new` was added upstream, clipping `quit` — the one hint a stuck user most needs. |
| `src/tui/components/HelpOverlay.tsx` | Small copy/layout fixes. |
| `src/tui/store.ts`                | `previewWidth` default and clamp. |
| `src/commands/sidebar.ts` (+ tests) | Related to the alternate-screen / repair work above; not re-checked in isolation. |
| `README.md`                       | This file's existence is now noted at the top. |

That's it. Everything else in the repo is unmodified upstream.

## What is *not* fixed here yet

A few things I tried to land locally and either abandoned or didn't get
working cleanly. They are explicitly **not** in the fork commit above, so
upstream behavior is unchanged for them:

- **Preview pane doesn't show the harness's bottom-right model name when
  the terminal is narrower than the harness TUI.** I poked at this with
  multiple scrollbar approaches (driving the scrollbox's `scrollLeft`,
  driving the inner text ref's `scrollX`, pre-padding the content with
  spaces) and none of them survived the test renderer without flakiness
  or worked cleanly in production. The right fix probably needs an
  upstream OpenTUI API change. If I ever get it working, it'll be a
  separate focused commit with a test that proves the rightmost columns
  are actually visible.

If you came here looking for one of these, sorry — they aren't here.

## Known differences between this repo and the GitHub mirror

The `untitled-unrevised/ccmux` mirror on GitHub was pushed with a `gh`
OAuth token that does not have the `workflow` scope, so GitHub rejected
the push because the commit history contains `.github/workflows/*.yml`.
Workaround: the mirror's history has the workflow files stripped at
every commit, which changes the SHA of every commit (including the
fork commit). The local clone's commit SHAs do not match the mirror's
commit SHAs. Both are valid as a representation of the same logical
content; just don't compare SHAs across them.

If you clone this repo, you get the local (with workflow files) version.
The mirror is for backup.

## How I work with this fork

- `git fetch origin` — grab new upstream commits
- `git rebase untitled-unrevised/main` — replay my fork commit on top of
  upstream's new HEAD
- `git push` — pushes to my GitHub mirror
- I don't run upstream's CI on my mirror (the workflow files are
  stripped there, and I don't care enough to fix it)
- I don't open PRs against upstream. The local changes are personal
  workflow tweaks; if they ever become generalizable, I'll extract
  them into a focused PR with a real test. So far, nothing has.

## License

Same as upstream. See `LICENSE`.
