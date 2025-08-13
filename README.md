# Dovekie

Livecode anything!

Every time you add a parameter to code, you're creating an infinite world of possibilities. But it can be hard to explore them. One approach is to choose a few parameters and create an interface of sliders and dropdowns (e.g. [dat.gui](https://github.com/dataarts/dat.gui)).

Dovekie aims to be more flexible: you can use expressions to combine time, mouse events, MIDI events, and whatever else you'd like!

*At this time, this is a work in progress! Things are rough and will totally change!*

## Lineage

Dovekie is a JavaScript package that surfaces the livecoding features from the Rust package [Murrelet](https://github.com/jessstringham/murrelet) so you can use them in JavaScript.

## Publications

[ICLC 2025](https://zenodo.org/records/15527382)
[Alpaca 2023](https://alpaca.pubpub.org/pub/dpdnf8lw/release/1?readingCollection=1def0192)

# Expression language


## Functions to modify the global config

When setting up the model, you can use these functions to

`model.set_div(div)`

Mouse events (`mx`, `my`, `cx`, `cy`) as well as window info (`w`, `h`) are based on this.

`model.set_bpm(80)`

update the beats per minute to 80.

`model.set_beats_per_bar(3)`

Sets the number of beats per bar.


## Built-in variables

 - `t` (float) `ti` (int): the current "bar" of music, e.g. increases by 1.0 every `bpm` / `beats_per_bar`.
 - `tease`: a shortcut for a value that eases between 0 and 1 every 4 bars.
 - `f` (float) `fi` (int): the frame

if `set_div` was called
 - `w` and `h` the width and height of the provided div
 - `cx` and `cy` the x and y coordinates within the provided div of the last click location
 - `mx` and `my` the x and y coordinates within the provided div of the last mouse location

## Custom variables

You can add in your own variables! If you send in a dictionary to `model.update` , it'll update the variable value which can then be used in expressions.

```js
model.update({ "audio": 2.1 });
```

## functions

`s(x, a, b)`

`s` will scale `x` (assumed to be between 0 and 1) to be between `a` and `b`.

`ease(x, freq, [offset])`

`ease` will bounce a variable (like `t`) between 0 and 1 `freq` times. The optional `offset` is useful if you want to have mulitple things with the same frequency but starting at different times.

`rn(seed, seed_offset)`

uses the floor of `seed` to create a pseudo-random number. `seed offset` is conveninent shorthand if you want multiple different random numbers from the same source.




# Dev

