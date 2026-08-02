function submitContactForm(event) {
  event.preventDefault();
  var container = event.target.parentNode;
  var form = container.querySelector(".contact-form");
  var success = container.querySelector(".contact-form-success");
  var errorContainer = container.querySelector(".contact-form-error");
  var errorMessage = container.querySelector(".contact-form-error-message");
  var backButton = container.querySelector(".contact-form-back-button");
  var submitButton = container.querySelector(".contact-form-button");
  var loadingButton = container.querySelector(".contact-form-loading-button");

  submitButton.style.display = "none";
  loadingButton.style.display = "inline-block";

  fetch(form.action, {
    method: "POST",
    body: new FormData(form),
    headers: {
      Accept: "application/json",
    },
  })
    .then((res) => res.json().then((data) => [res.ok, data]))
    .then(([ok, data]) => {
      if (ok) {
        form.style.display = "none";
        success.style.display = "block";
      } else {
        errorContainer.style.display = "block";
        errorMessage.innerText =
          data && data.errors ? data.errors.map((e) => e.message).join(", ") : "Oops! Something went wrong, please try again or email me directly.";
        backButton.style.display = "block";
      }
    })
    .catch(() => {
      errorContainer.style.display = "block";
      backButton.style.display = "block";
    })
    .finally(() => {
      loadingButton.style.display = "none";
    });
}

function resetContactForm(event) {
  var container = event.target.parentNode;
  var form = container.querySelector(".contact-form");
  var errorContainer = container.querySelector(".contact-form-error");
  var backButton = container.querySelector(".contact-form-back-button");
  var submitButton = container.querySelector(".contact-form-button");

  errorContainer.style.display = "none";
  backButton.style.display = "none";
  submitButton.style.display = "inline-block";
  form.style.display = "block";
}

var contactFormContainers = document.getElementsByClassName("contact-form-container");

for (var i = 0; i < contactFormContainers.length; i++) {
  var contactFormContainer = contactFormContainers[i];
  if (contactFormContainer.classList.contains("contact-form-handlers-added")) continue;
  contactFormContainer.querySelector(".contact-form").addEventListener("submit", submitContactForm);
  contactFormContainer.querySelector(".contact-form-back-button").addEventListener("click", resetContactForm);
  contactFormContainer.classList.add("contact-form-handlers-added");
}
