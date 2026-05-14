document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const messageDiv = document.getElementById("message");
  const adminStatus = document.getElementById("admin-status");
  const adminNote = document.getElementById("admin-note");

  let adminToken = null;
  let adminUsername = null;

  function getAuthHeaders() {
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  }

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAdminMessage(text) {
    adminStatus.textContent = text;
    adminStatus.classList.remove("hidden");
  }

  function renderAdminState() {
    const isAdmin = Boolean(adminToken);
    loginForm.classList.toggle("hidden", isAdmin);
    logoutButton.classList.toggle("hidden", !isAdmin);
    adminStatus.classList.toggle("hidden", !isAdmin);
    adminNote.textContent = isAdmin
      ? "Teacher is logged in. You can now register or unregister students."
      : "Teacher login is required to register or unregister students.";

    Array.from(signupForm.elements).forEach((element) => {
      if (element.tagName === "BUTTON") {
        element.disabled = !isAdmin;
      } else if (element.tagName === "INPUT" || element.tagName === "SELECT") {
        element.disabled = !isAdmin;
      }
    });

    if (isAdmin) {
      setAdminMessage(`Logged in as ${adminUsername}`);
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    if (adminToken) {
                      return `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`;
                    }
                    return `<li><span class="participant-email">${email}</span></li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        setMessage(result.message, "success");
        await fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (response.ok) {
        adminToken = result.token;
        adminUsername = result.username;
        setMessage("Teacher login successful.", "success");
        renderAdminState();
        await fetchActivities();
        loginForm.reset();
      } else {
        setMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      setMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/admin/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch {
      // Ignore logout errors, just clear local state
    }

    adminToken = null;
    adminUsername = null;
    setMessage("Logged out.", "info");
    renderAdminState();
    await fetchActivities();
  }

  async function handleSignup(event) {
    event.preventDefault();

    if (!adminToken) {
      setMessage("Teacher login is required to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();
      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        await fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  loginForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);
  signupForm.addEventListener("submit", handleSignup);

  renderAdminState();
  fetchActivities();
});
