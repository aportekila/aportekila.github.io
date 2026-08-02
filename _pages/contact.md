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
      <div class="row">
        <div class="col-md-7">
          <p>Have a question, collaboration idea, or role you think I'd be a good fit for? Send me a message below.</p>
          {% include contact_form.liquid %}
        </div>
        <div class="col-md-5">
          <div class="contact-expect-card">
            <h3>What to expect</h3>
            <ul>
              <li>I read every message myself and usually reply within a few days.</li>
              <li>Best for: research collaboration, roles, reviewing/mentoring requests, or questions about my published work.</li>
              <li>Prefer email? Reach me directly at the address below.</li>
            </ul>
          </div>
        </div>
      </div>
    {% else %}
      <p>The contact form isn't set up yet &mdash; email me directly instead:</p>
    {% endif %}

    <div class="social">
      {% include social.liquid %}
    </div>
  </article>
</div>
