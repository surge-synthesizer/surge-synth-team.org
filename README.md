# surge-synth-team.org

## Working with the website

We use a **Jekyll theme** for this site. 

It is called **Sleek** and can be found [here.](https://github.com/janczizikow/sleek)

You can download **Jekyll** from [here.](https://jekyllrb.com/)

# Adding and editing pages

Jekyll was built for blogs and is built around a notion of posts. We use a post for each virtual instrument, plugin, library, or project we are working on. Each post in the `_posts` folder is used to generate a card on the main page and a detail page.

You can use GitHub as a CMS to add or edit pages. This can get most of the simple things you want to change done.

To make changes this way, all you need to is fork the project. Once you have done that you can create a branch on your fork make changes and then open a PR. [This](https://github.com/surge-synthesizer/surge/blob/master/doc/git-howto.md) git document for the OSS Surge-Synthesizer project outlines a suggested way of doing work and then creating PRs. 

Once you have created a branch in your fork you can then just click the edit button (upper right corner) to edit a post in the `_posts` folder. Because the posts are markdown documents you can just edit stuff in place in the GitHub editor. 

To add a project, open the `_posts` folder in your fork and click the create new file button. Each post file name starts with a date formatted like `2020-02-23`. Follow the date with a name for the post and the `.md` file extension (as an example, `2020-02-18-surge.md`).

A post has a frontmatter section and a body section. The frontmatter section is metadata about the post, such as which image to use and what categories it belongs to. A new post would have frontmatter that looks something like:

```
---
layout: post
order: 6
title: "Adaptive Tuner"
summary: Adjusts the pitches of notes dynamically
featured-img: surge-team 
categories: [Effect, Microtuning]
---
```

The title is the display name for the post, the summary is the text in the card on the main page, the featured image is an image for the project, and the categories are a comma-separated list of any appropriate categories (look at the other projects for categories that already exist). The order determines which position a post appears in on the main page.

The featured image "surge-team" shown in the example is a default image that you can use if you don't have an image yet. See the next section for instructions on adding a custom image.

The body section of a post is where you can write a description of the project in markdown. It is everything after the frontmatter section.


## Adding custom images and changing CSS

The Sleek theme runs an image optimizer to produce multiple versions of images suitable for different screens. It also compiles all of the `.scss` files to a single `main.css` file. Both the optimized images and `main.css` end up in the `assets` folder and this is what gets served when people visit our site.

Add your style changes where appropriate in the `_sass` folder and add images to the `_img/posts` folder then follow the build steps in the next section. Images must be `jpg`s or image optimizer will fail.

## Building and serving the site

Being comfortable using a command line and understanding how to get everything installed with the correct file permissions level will be key. On a Mac or Linux machine, this means installing an updated version of Ruby in a different location that was in $PATH and had correct read/write permissions.

To accomplish this goal, you can use `rbenv` and `bundler` to get Ruby installed, and use `bundler` to install Jekyll. To generate the images and compile the `.scss` files, you will need to install `gulp`, which means you first need to [install node](https://nodejs.org/en/download/).

By the time you have Ruby and node installed on macOS or Linux successfully, you are ready to run the commands below at the command line. 

```
gem install jekyll
gem install bundle
npm install --global gulp-cli
git clone https://github.com/surge-synthesizer/surge-synth-team.org 
cd surge-synth-team.org
bundle install
npm install
```

In theory, the Sleek theme comes with a modern development environment to refresh the brower with each change you make. I was not able to get this working on my system, but I was able to develop with two commands.

Each time you make a change to an `.scss` file or add an image:

```
gulp build
```

Serve the site and view it on localhost with:

```
bundler exec jekyll serve
```

You can keep this second command running in a separate terminal window and it will refresh after each build.


## Docker

You can use Docker to help with all of this stuff. That requires for you to have a Docker account. It will also provide a live version of your site at localhost. Super useful if your changing files often.

If you have Docker installed, you should be able to run the project by switching to the root dir and running:

```
$ rm Gemfile.lock ; docker run --rm -it -v "$(pwd)":/usr/src/app -p 4000:4000 starefossen/github-pages ; git checkout Gemfile.lock
```

