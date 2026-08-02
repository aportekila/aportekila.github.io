---
layout: page
title: Contact
permalink: /contact/
description: Get in touch for research collaboration, roles, or questions about my work.
nav: true
nav_order: 6
---

<div class="post">
  <article>
    {% if site.contact_form.enabled %}
      <p>Have a question, collaboration idea, or role you think I'd be a good fit for? Send me a message below.</p>
      {% include contact_form.liquid %}
    {% else %}
      <p>The contact form isn't set up yet &mdash; email me directly instead:</p>
    {% endif %}

    <div class="social">
      {% include social.liquid %}
    </div>
  </article>
</div>
