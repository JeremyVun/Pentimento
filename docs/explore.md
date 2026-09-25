# Exploring pacing and interaction

Branch `explore-pacing`. This doc holds Jeremy's feedback verbatim, the working vision, and what each prototype taught us. `docs/project.md` stays the description of the shipped game until a direction is chosen.

## Jeremy's feedback after playing (2026-09-25, verbatim)

> This game is surprisingly beautiful. It was kind of boring at the start, but then as the seasons progressed it became an incredible piece of art, especially with the music. I think there is a lot of potential here to keep polishing and uplifting the game. Any ideas? does the UI need work? Or maybe a rethink about how we are presenting the scene?
>
> What i definitely felt was that i was kind launched into it without knowing much about the character (the painter). I didn't know who she was or cared about who she was until i learned more about her life as the paintings progressed.

> some interesting ideas. I do think her age should show in the painting. It really started to get heavy and beautiful when she was going through things in life and she was painting what she saw, and the painting was a way for the player to see into her life at that moment too.
>
> Think about it more. I dont know if she should have a name. The player in some sense becomes her as she goes through her life.
>
> I will also admit, in terms of gameplay, something needs to be rethought. I just ended up painting the entire scene and then pressing finish painting before the word descriptions finished. I found myself sitting ther just reading the text and it was boring for a game. It wasn't until later that i started reading it a bit more at the start to figure out what was happening, but i was still going through the paintings reaally quick.

> yea im not sure about limited paint. it might make sense for one of the paintings, but not all of them.

> this has been a great discussion with a lot of interesting ideas. here are some of my own. As a player it's a sort of strange feeling where it starts out as her saying she wants to leave, but then every painting is literally the same place - she never moved, she never took the adventure she wanted to take. There's a sort of regret with that, but also beauty in how she still made her own story all the same. And how her daughter and grand dauther were able to do what she couldn't. i think this is a game that would resonate with women. We just need to do something about the pacing and the interaction mechanics.
>
> think about it and start exploring to see what works best in your opinion. maybe the right way to present the story is something that needs to be discovered.

## Decisions so far

- She stays unnamed. The player becomes her.
- Her age and state of mind should show in the painting itself.
- Limited paint is not the core mechanic. It may suit one chapter (thirty-one, the newborn year).
- Theme to bring forward: she wanted to leave and never did. Every painting is the same view. Regret, and the beauty of the life she made there anyway. Her daughter and granddaughter do what she couldn't.

## Diagnosis

- Pouring fills a shape per click, so the whole board is covered in seconds. Nothing asks the player to choose or to wait.
- Every figure crosses the view across the whole sitting (Joe's walk takes 95% of the chapter), so nothing happens at a particular moment. Memories wake whenever their area is covered, so flooding the board wakes them all at once.
- The story arrives on a timer under the board, apart from the hands. Players either paint or read, never both.

## Working vision

The painting is how she holds on to what passes her window. She never leaves, but the ferry, the swallows, Joe, the bus and June all pass through the view, and what she catches in paint stays. Things leave the frame; she stays and keeps them.

Core loop to test, "wet paint lives, dry paint keeps the moment":
- The pencil sketch shows the present moving: people and boats cross in pencil over the old painting.
- Poured paint brings an area to life in colour, as now.
- As the paint dries, that area slows and holds the moment it dried in. Pour again to wet it and catch a new moment.
- The finished board is a collage of the moments you caught: the sky at dawn, the bridge when he crossed.
- Things happen at moments across the music, so there is a reason to stay for the whole sitting.
- Lines come from what you paint and catch, not a timer.

## Jeremy's feedback on prototype 1 (verbatim)

> i think the issue is still that as a user i am watching the painting, but also having to read text underneath.

## Jeremy's second playtest (verbatim)

> pacing is important, i finished the painting and then nothing happens for a long time. Also, was it a deliberate decision not to have the game full screen?
>
> The fill in mechanic also needs proper work. i filled it in, and then it became unfilled in again really quickly

> oh yea, because you start introducing hard boundaries later on, it feels like the game is buggy when the painf ill doesn't work as they learnt it did before. Also, the town never really changes over time like i thought it might.

What changed:
- Pouring works the same in every sitting. No spilling across shapes at nine, no running paint at forty-four: her age shows only in how the paint looks (chunkier strokes at nine, slower drying at forty-four). A click now covers most of a shape; holding finishes it. Paint no longer loses reach while it spreads (that shortened every pour); a separate fading "fresh paint" channel re-wets dry paint when you pour over it.
- Moments come when she's ready (enough painted, or the brush has been down a few seconds) rather than on the clock, and move shorter distances. The sitting ends by itself once everything has passed and she has stopped painting for a few seconds.
- The board fills the window, and Begin goes full screen. Hints, notes and buttons sit on the board.
- The town grows across the life: houses spread across the fields after the bridge opens, a mill smokes at forty-four and is cold by seventy-two, telegraph poles, houses up the hill, flats by the church, and wind turbines at the end.

## Jeremy on her age in the painting (2026-09-25, verbatim)

> do you think we can also change the look of the painting? a 9 year old would paint something that looks a bit different than someone who is older and has many more years of painting no? the difference doesn't have to be too exaggerated, but noticeable enough. So pentimento really does feel like different paintings ontop of one another, instead of just the same painting in different scenes.

He left the choice of the grandchild's leaving line to us: "You pick the line that you think works best for this game". The train note now says she moved away at eighteen, like June.

What changed: each year is now painted in her hand at that age (`hand` in `src/scene/config.ts`). Nine gets a child's scrubbing strokes, simplified shapes, bright unmixed paint and wobbly outlines. Sixteen is bold and dramatic, forty-nine has practised broken colour, and seventy-two is pale and loose. The grandchild paints in her own crisp, flat style. Where a year isn't painted over, the older hand shows through, so the board reads as paintings on top of each other. The table is in `docs/styles.md`.

## Jeremy on how fast paint flows (2026-09-25, verbatim)

> Do you think the paint fills in slightly too quickly?

> yea, agreed, the paint should flow a bit slower, please try 2 to 3 seconds

What changed: a click covered 16 to 18% of the board in under a second, so the board was full in five or six seconds. Now a pour takes two to three seconds to flow across its shape and reaches just as far. Spread passes run at a fixed rate (`SPREAD_PASSES`), not once per frame.

> I just wanted to previous fill to be slower, but you changed the style of the fill as well

A first attempt also roughened the spreading edge into lobes. Jeremy wanted only the speed changed, so the fill looks exactly as it did before, just slower.

## Polish after the merge (2026-09-25)

- Catching now takes a pour on the moment while it's there. Wet paint it happens to walk through no longer catches it, so catching is always a choice.
- A warm glow breathes around whatever is passing and not yet caught (`uAttn`).
- The people she only imagines (her father, Joe at seventy-two) are drawn on their own pencil layer that shows over wet paint too (`drawGhosts`).
- Her age in the paint (`pour` in the scene config): at nine the paint spills into neighbouring shapes and splashes; at forty-four it bleeds, runs down in streaks and dries slowly.
- After a sitting she gives at most six notes before the closing line. Moments are always told; painted things fill the rest.
- The music plays on under her notes and resolves as her closing line begins. It used to stop as the paint dried, 30 to 60 s before the score's end, so she talked over the river alone.
- Still to judge in motion: whether pencil Joe at seventy-two is noticeable enough.

## Prototype 2: reading and painting at separate times (built 2026-09-25)

- No text while painting. The music, the view and the moments carry the sitting. Only the first chapter's two functional hints remain, under the board.
- With the age card, one or two opening lines are inked onto the pale board before the sketch appears (`opening` in `src/story.ts`). Click to move on.
- Once the painting dries and is still, she talks about what's in it: `before` lines, then each thing that was painted or caught in the order it happened, then `after` lines, then the closing line. Each note sits on the painting beside the thing it's about, which stays lit while the rest dims (`focus` in the composite). Click to move on.
- Narration now lives on the board (`src/narration.ts`), not in a strip under it.

Jeremy, after playing it (verbatim):

> i think it works way better now this way with the words being before and after as reflections.

## Prototype 1: moments (built 2026-09-25)

Play it with the worktree's dev server (`npx vite --port 5327` in `/private/tmp/pentimento-explore`). `?from=<chapter id>` starts at that chapter with every earlier year painted in full; `?speed=` still works. `tools/moment.mjs` plays one chapter and tries to catch each moment.

What changed:
- Poured paint stays wet for roughly 20 to 60 seconds (`DRY_RATE` in `src/game.ts`). While wet it moves with the view; as it dries it holds the moment it dried in (`HOLD_FS`). Pouring again wets it.
- The pencil layer now shows the moving people, boats and birds, drawn fresh every frame (`drawFigures`). Where the paint isn't alive they show as pale pencil silhouettes, and reds and yellows show in colour: Joe's coat, June's coat, the robin, the train.
- Each chapter has something that passes once (`moments` in `src/story.ts`, timings in `src/scene/config.ts`, positions in `momentSpot`). Pour on it while it's there and it's caught: it reacts, and the paint around it sets a few seconds later so the painting keeps it. Missed moments get their own line. (Prototype 2 moved all these lines to after the sitting.)
- The bell is rung by the game (`audio.bell()`), not written into the scores, so eight o'clock happens mid-sitting.
- Finish painting only appears once every moment has passed.

| Chapter | What passes | Notes |
|---|---|---|
| Nine | The ferry crosses once | Teaches catching, with a one-off hint |
| Sixteen | The afternoon train to the city, along the far hills, leaving | Her wish to leave |
| Twenty-three | Joe crosses at eight | Caught, he waves and stays in the painting |
| Thirty-one | Children jump off the bridge | The one chapter with limited paint (9 s of pouring); she stops when it runs out |
| Forty-four | Her father under the fig tree, in pencil only | A ghost: painting him shows the empty place |
| Forty-nine | The eight o'clock bus, June's red coat in the back window | |
| Seventy-two | Pencil Joe crosses at eight, then a robin comes to the wall | A ghost: painting him shows an empty bridge |
| Eighty-six | The grandchild playing in the garden | No pencil at all, only blurred colour |
| Twenty years later | The afternoon train arrives, then children jump | The grandchild comes home on the train Gran wanted to leave on |

Open questions for Jeremy:
- Does catching give the sitting enough shape, or does it need more than one or two moments per chapter?
- Does the drying (paint going still) read, and is it welcome, or does it take away the moving painting he liked?
- The ghosts at forty-four and seventy-two: too much, or the right weight?
- Figures are small at the board's scale. Joe's ghost in the snow is hard to spot apart from his yellow coat.

Not yet tried:
- Her age in how the paint behaves at nine (splashy, spills over edges) and forty-four (watery, bleeds).
- The opening line ("This board is older than your mother") still assumes the player knows who "you" is.
- More of the leaving theme in the grandchild's words (for example, that she lived far away before coming back). Needs Jeremy's say, since it adds facts to the story.
