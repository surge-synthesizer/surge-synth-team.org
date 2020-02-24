---
layout: page
title: Categories
permalink: /categories/
---

<div>
{% for category in site.categories %}
  <div class="archive-group">
    {% capture category_name %}{{ category | first }}{% endcapture %}
    <div id="#{{ category_name | slugize }}"></div>
    <p></p>
    <h3 class="category-head">{{ category_name }}</h3>
    <a name="{{ category_name | slugize }}"></a>
    {% for post in site.categories[category_name] %}
    <article class="archive-item">
      {% if post.external_url %}
        <h4><a href="{{ post.external_url }}">{{ post.title }}</a></h4>
      {% else %}
        <h4><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h4>
      {% endif %}
    </article>
    {% endfor %}
  </div>
{% endfor %}
</div>