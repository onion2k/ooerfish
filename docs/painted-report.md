# The painted edge: the pass (part 5)

Untracked, in the worktree `/Users/christopherneale/projects/ooerfish-painted` (branch `painted`). Nothing pushed.

## Outcome

Green. `npm run check` exits 0, `npm run fuzz -- --seeds 1-24` is clean, nothing is red, no baseline or picture was written in this pass.
The one finding is the frame: the branch costs about 0.30 ms more than its parent (2.85 against 2.55 at the standard scene), inside the 8 ms budget and the 15% tolerance of the baseline written in part 3. Boot is about 70 ms slower than the parent (615 against 543), within its tolerance, baseline left at 537.

## Commits on the branch (oldest first)

- b87bd2e The lake draws with artshape-render v0.38.0, which carries the painted edge (part 1)
- 26f6977 The boulders and the cliff's lumps are faceted rock with a painted edge, and the lab can turn the paint off (part 2)
- a0bb7b6 The lake's shade is deep and cool, its rocks darker, and its corners shaded, as the painted edge wants (part 3)
- 38bb8ea The cabin's timber and the jetty's planks carry the wood's painted edge (part 4)
- 6285971 The look pictures hide the boot text, which a picture taken right after boot could catch fading (this pass)
- fea506b The lake's rocks and their painted edge are in the project's file, with the plan they were built from (this pass; CLAUDE.md, plan moved to docs/painted.md)
- c63c8c4 The look pictures take the boot cover off the page, since its display rule beat the hidden attribute (this pass; fixes 6285971)

## Step 1, the two small things

(a) `hideOverlays` in `smoke/look.spec.ts`. My first change (6285971) set `hidden = true` on `#boot`, which does nothing: `#boot { display: grid }` in `index.html` beats the hidden attribute. I found this when an ad hoc screenshot (not through `hideOverlays`) still showed the cover and "loading the scenery..." mid-fade. The fix (c63c8c4) sets `style.display = 'none'`. `npm run look` run after each: 18 passed, no picture changed, so none had caught the boot text.
(b) CLAUDE.md: a "The rocks" entry in the layout, "A painted edge on a solid" in the model features, `?paint=off`/`?paint=maybe` in the lab's edge cases, a pointer to `docs/painted.md`. The plan was untracked, so it was moved with `mv` and added in that commit. Prettier clean, `check:quick` ran as the pre-commit hook on each commit.

## Step 2, `SMOKE_PORT=5206 npm run check`

Exit 0 (log at the session scratchpad `check.log`). Per gate:

- check:quick: 401 unit tests pass in 39 files.
- fuzz: 12 seeds x 4000 frames, no rule broken.
- determinism: 6 seeds played twice, the same every seed (12 checkpoints each).
- leaks: 1 game of 10 minutes, most reached fish 6, splashes 0, save bytes 2, heap 8.6 MB, everything bounded. Nothing new kept. (The hour-long run, `npm run leaks`, was not run.)
- bench (all within the +/-15%): fish swimming +7%, casting +4%, fight +7%, full lake +6%. The same four against the parent, run by me in the parent worktree: +7%, +3%, +8%, +7%. The branch has not moved the bench.
- pace: median 2.31 min against the baseline 2.13 (+8%, within +/-20%). The parent reads the same 2.31 on all eight seeds, so the branch has not moved it either; the baseline is just that far from today's reading and is not touched.
- smoke: 40 passed (1.3 min), including paint on against off at the boulder 2659 pixels apart, perf boot 611 ms, frame 2.85 ms, download 109,034 bytes, scenery 202,204 bytes (all within), the water's frame day 2.87 and night 2.85 ms, lean 2.07 ms against full 2.83 ms.

## Step 3, fuzz seeds 1-24

24 seeds x 4000 frames, no rule broken (splashed 97, nibbled 72, bitten 34, hooked 33, missed 13, slipped 11, landed 10).

## Step 4, the frame against the parent (0546f35), ms, `measureFrame`, headless Chromium, three samples per run, runs in turn B,P,B,P

| scene        | branch run 1   | parent run 1   | branch run 2   | parent run 2   |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| standard     | 2.85 2.84 2.86 | 2.55 2.55 2.54 | 2.85 2.83 2.84 | 2.55 2.54 2.50 |
| shore, night | 2.84 2.83 2.84 | 2.53 2.53 2.52 | 2.83 2.83 2.84 | 2.54 2.53 2.52 |
| boat         | 2.53 2.54 2.54 | 2.25 2.29 2.28 | 2.52 2.54 2.53 | 2.29 2.29 2.28 |
| overhead     | 2.26 2.26 2.25 | 1.94 1.95 1.95 | 2.26 2.25 2.26 | 1.95 1.95 1.97 |

The gap is 0.30 ms at the standard scene and night, 0.25 on the boat, 0.31 overhead. Splitting it: with the occlusion set to 0 on the branch (temporary edit, reverted) two runs read standard 2.61, night 2.60, boat 2.35, overhead 1.98. So the occlusion is about 0.24 ms (0.28 overhead), and everything else (the rocks' meshes, the paint pass, the new light, the cabin) is about 0.06 ms at the standard scene (0.03 overhead, 0.10 boat). This is lower than part 2's guess of 0.15 for the rocks. `game.paint('off')` cannot isolate the rocks: it reads the same 2.85 as on, because off zeroes the sets' strength and the painted meshes are still drawn.

## Step 5, the rung

- `?rung=lean`: standard scene 2.06, 2.04, 2.06 ms, well under 8; grass near 0 and far 0; the picture with paint on is not equal to paint off, so the rocks are painted on lean.
- `game.rung()` set full, lean, full, lean, full, with 30 steps after each: the readings were as set, and no console error, page error or failed request.
- The governor: three boots with `rung: 'auto'` each chose `full`, as the parent's frame of 2.5 ms would (this was not run against the parent's governor).

## Step 6, boot, quiet machine, `bootMs` (baseline 537)

- Branch, five runs: 616, 611, 615, 615, 615. Typical 615 (+78 on the baseline).
- Parent, three runs: 549, 543, 538. Typical 543.
- Branch with the occlusion at 0, three runs: 598, 603, 604. So the occlusion adds about 12 ms and the rest, about 60 ms, is the painted build's pipelines (and the rocks being built). It is inside the gate's tolerance (`[0.35, 250]` in `smoke/judging.ts`), and the baseline is left. Part 3's higher readings (633 to 779) were taken on a busier machine.

## Step 7, looked at

`smoke/screens/phone.png` and `phone-fight.png`, both opened: the cliff's lumps carry a pale chalk edge and read as faceted rock, the near boulder at the lower left has its lip, the waterfalls, the gauge, the Reel button and the Cast and lab buttons are clear, nothing is clipped. An ad hoc 390x844 frame on `lean` at the standard scene, phone view (the first attempt caught the boot cover, which is how the hideOverlays fault was found): no grass (the bank is flat green), the cliff and the boulders painted as on full, the near boulder's lip at the left edge intact, the stones along the shore, nothing broken. The picture is in the scratchpad (`phone-lean.png`) and not kept in the repo.

## The nine points

1. Acceptance criteria first, seen failing: done in parts 1 to 4 (each part's commit); not re-run here.
2. Edge-case checklist: gone through for what applies. Lab (each time, view, paint on/off, `?paint=maybe` refused: settings tests and the controls smoke), rung (above), water, scale (the frame is the measure), save (nothing saved), determinism (unchanged). Not reached: line, fish, snags, boat anchoring, calendar, cabin interior, which the rocks do not touch. Not verified: a clean lake and a sick one at every time with paint off, beyond the look pictures.
3. Full check green: done, with no gate moved by this pass.
4. End-to-end test: the controls test clicks the lab's paint control and `game.paint('off')` is compared by pixel count (smoke, in the 40). A tap on the control by a user is covered there.
5. Fuzzer: seeds 1-24 clean. Not reached: the fuzzer has no `paint` action and there is no new rule in `invariants.ts`; I did not add one (outside the pass). Worth adding if the paint should be fuzzed with the other levers.
6. Performance: done, step 4 above (+0.30 ms at the standard scene, 2.85 against 2.55, inside 8 ms) and step 6 for boot.
7. Looked at: done at a phone width, still, for the existing pictures and one lean frame, and each part's pictures were looked at when written. Not done: moving (no frames played and watched), and a desk's width beyond the 1280x800 pictures that part 2 to 4 looked at.
8. Mutation checks: not verified. I did not put the bugs back in the part 2 to 4 tests in this pass.
9. Not verified, plainly: the one-hour `npm run leaks`; real-Chrome or another GPU (the gates are the bundled Chromium on this machine's GPU); the mutation checks; the governor on a slower machine; the paint on a real phone.

## Noticed and left alone

- `index.html`'s `#boot { display: grid }` defeats the hidden attribute; the page itself hides the cover with the `gone` class, so nothing is wrong, but any other code setting `hidden` on it will not work.
- `src/look.ts` mentions `docs/specs/painted-experiments.md`, which is not in this worktree (only `docs/painted.md` and this report are).
- The pace baseline (2.13) and the bench readings sit +3% to +8% above their baselines on both the parent and the branch, so the baselines were written on a quicker day; not this branch's doing.
- Frame baseline 2.95 against today's 2.85 (the frame is now written 0.1 ms above what it reads on a quiet machine): fine under the gate.
- The parent worktree `/Users/christopherneale/projects/ooerfish-parent` has been removed. No temporary spec files remain in the branch (`git status` clean apart from the untracked `docs/painted-report.md`).
