---
slug: surge-effects
title: Surge XT Effects
order: 2
summary: The Surge effects module in its own plugin.
thumbnail: /screenshots/surge-effects.png
categories: [Effects]
url: https://surge-synthesizer.github.io
issue_tracker: https://github.com/surge-synthesizer/surge-fx/issues
---

Surge has a cool set of effects, and also works as an audio input source in most DAWs so you can use them using
routing and latch mode with the full synth.

But in a couple of situations, it is powerful to have Surge effects as a separate plugin. The Surge Effects Bank plugin allows
you to do this - it is included as an extra plugin in the macOS and Windows Surge installers.

To use Surge Effects Bank, simply drop the VST3 or AU into your DAW as a plugin in an effects slot. The controls are
fairly obvious, but the knobs adjust various parameters, and the switches allow tempo sync for appropriate parameters.

The one feature Surge Effects Bank offers which is impossible to do in Surge synthesizer invovles the vocoder effect. Vocoder
is a powerful tool in Surge, where the sidechain acts as the modulator and Surge itself acts as the carrier. But, using the
Surge vocoder with a sound source other than Surge as a carrier would require two sidechains, a feature which is unsupported
in most modern DAWs. With the Surge Effects Bank plugin, you can sidechain a modulator in, while also using the current track as a
carrier source, allowing other synths or audio sources into the vocoder circuit.

Surge Effects Bank is included with [Surge Synthesizer](https://surge-synthesizer.github.io).
