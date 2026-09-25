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

## Prototypes and findings

(Filled in as each one is tried.)
