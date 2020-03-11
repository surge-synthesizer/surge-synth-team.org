---
layout: post
order: 5
title: "Tuning Library"
summary: We’ve added microtuning support to several instruments. Our core SCL/KBM calculation engine is available as a standalone C++ header.
featured-img: tuning-library
categories: [Synth, Microtuning]
---

Alternate Tuning is tricky. You have to parse and interpret SCL and KBM files, you need to test in a bunch of ranges, you need to think
about edge cases. When we turned to do it in Surge, we got it wrong more often than we got it right. And, since we are committed to
open source, we thought about sharing that experience.

So we took our core tuning implementation from surge and converted it into a standalone MIT licensed C++-14 header only library.
We used this to build [the tuning workbench synth](/tuning-workbench-synth/) and also to add tuning to [our dexed form](/dexed).
And soon we will back-port it into surge.

But you can use it today!

So if you are a developer writing a virtual instrument, and you want to add support for SCL/KBM tuning, simply add our code to
your source tree and use our data structures. We provide functions that given an SCL and KBM file or data source will give you
an object which tells you the frequency of the entire keyboard in a mapping aware fashion.

The details are at [our github repo for the project](https://github.com/surge-synthesizer/tuning-library) but the short version is

1. Add our code as a submodule and adjust your include paths
2. `#include "Tunings.h"`
3. Write code in your synth to handle getting SCL and KBM files
4. Use the API as [documented in our header](https://github.com/surge-synthesizer/tuning-library/blob/master/include/Tunings.h)
   and as [exercised in our tests](https://github.com/surge-synthesizer/tuning-library/blob/master/tests/alltests.cpp) to find
   the frequency for your note. Adjust your oscillators accordingly and go.
   
The [tuning workbench synth](/tuning-workbench-synth) provides a complete worked example of doing this in a JUCE plugin.

Also, the code is open source! We welcome pull requests and API enhancements and discussions about what to do next. Our plans
for new features are in the (issue list)[https://github.com/surge-synthesizer/tuning-library/issues] and we welcome any and
all participants!

Finally, we licensed the project under an MIT license to allow a broader group of users to add tuning to their code.
You can include this library in commercial projects and closed source; you can make changes and not contribute them back;
and you can do all the things the MIT license allows. We made this choice since we want to see tunable VIs flourish! 
But while there is no obligation to do so, if you would like to let us know when you integrate the library with your synth
that would be super polite, and if you want to add the project to the list of open source libraries you consume, you
can do so using the URL for this page. 

Enjoy!
