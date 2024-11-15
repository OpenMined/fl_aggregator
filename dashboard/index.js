// Add this near the top of the file with other global variables
let serverPort = 8080; // Default port
let metadataDatasite = ""; // Placeholder for the datasite
let logIntervals = {};
let currentSortColumn = "status";
let currentSortDirection = "desc";
let completedProjectLogs = new Set();

// Add this new status emojis mapping
const statusEmojis = {
  invite: "📨",
  running: "⚡",
  complete: "✅",
};

// Function to save the port to localStorage
function savePort() {
  try {
    const portInput = document.getElementById("server-port").value;
    localStorage.setItem("serverPort", portInput);
    serverPort = portInput;
    checkServerStatus();
    fetchMetadata();
  } catch (error) {
    console.error("Error accessing localStorage:", error);
  }
}

// Retrieve saved port from localStorage on page load
document.addEventListener("DOMContentLoaded", () => {
  try {
    const savedPort = localStorage.getItem("serverPort");
    if (savedPort) {
      serverPort = savedPort;
      document.getElementById("server-port").value = savedPort;
    }
  } catch (error) {
    console.error("Error accessing localStorage:", error);
  }

  fetchMetadata();
  fetchProjects();
  checkServerStatus();

  // Setup column sorting
  document.querySelectorAll(".projects-table th").forEach((header) => {
    header.addEventListener("click", () => {
      const column = header.textContent.toLowerCase().replace(/\s+/g, "");

      // Toggle direction if clicking the same column
      if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortColumn = column;
        currentSortDirection = "asc";
      }

      // Update sort indicators
      document.querySelectorAll(".projects-table th").forEach((h) => {
        h.classList.remove("sorted-asc", "sorted-desc");
      });
      header.classList.add(`sorted-${currentSortDirection}`);

      // Refresh the table
      fetchProjects();
    });
  });
});

document.getElementById("server-port").addEventListener("input", (event) => {
  serverPort = event.target.value;
  checkServerStatus();
  fetchMetadata();
});

async function fetchMetadata() {
  try {
    const response = await fetch(`http://localhost:${serverPort}/metadata`);
    if (response.ok) {
      const data = await response.json();
      metadataDatasite = data.datasite || "";
      console.log("Metadata datasite:", metadataDatasite);
      document.getElementById("metadata-datasite").textContent =
        metadataDatasite;
    }
  } catch (error) {
    console.error("Error fetching metadata:", error);
    document.getElementById("metadata-datasite").textContent = "";
  }
}

async function fetchProjects() {
  try {
    const tbody = document.getElementById("projects-tbody");
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="loading">Loading projects...</div></td></tr>';

    const response = await fetch("./activity.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Loaded data:", data);

    // Check joined projects state
    const joinedProjects = await fetchJoinedProjects();
    renderProjects(data, joinedProjects);
  } catch (error) {
    console.error("Error loading projects:", error);
    document.getElementById("projects-tbody").innerHTML =
      '<tr><td colspan="7"><div class="loading">Error loading projects. Please try again later.</div></td></tr>';
  }
}

async function fetchJoinedProjects() {
  const url = `http://localhost:${serverPort}/apps/command/fedreduce`;
  const payload = { command: "list_projects" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const projects = await response.json();
      return projects
        .filter(
          (project) => project.state === "join" || project.state === "running"
        )
        .map((project) => ({
          state: project.state,
          sourceUrl: project.sourceUrl[0],
        }));
    } else {
      console.error("Failed to fetch joined projects.");
      return [];
    }
  } catch (error) {
    console.error("Error fetching joined projects:", error);
    return [];
  }
}

async function checkServerStatus() {
  const serverStatus = document.getElementById("server-status");
  try {
    const response = await fetch(`http://localhost:${serverPort}/apps/`);
    if (response.ok) {
      serverStatus.textContent = "✔️";
      serverStatus.classList.remove("error");
      serverStatus.classList.add("success");
    } else {
      throw new Error("Non-200 response");
    }
  } catch {
    serverStatus.textContent = "❌";
    serverStatus.classList.remove("success");
    serverStatus.classList.add("error");
  }
}

// Helper functions
function capitalizeFirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatId(value) {
  return value.replace(/[@\s]/g, "-at-").replace(/[^a-zA-Z0-9-_]/g, "-");
}

function getActionButtons(project, isJoined, isAuthor) {
  const buttons = [];

  if (project.status === "invite") {
    if (isJoined) {
      buttons.push(
        `<button class="btn btn-danger" onclick="leaveProject('${project.sourceUrl}'); event.stopPropagation();">Leave</button>`
      );
    } else {
      buttons.push(
        `<button class="btn btn-primary" onclick="joinProject('${project.sourceUrl}'); event.stopPropagation();">Join</button>`
      );
    }

    if (isAuthor) {
      buttons.push(
        `<button class="btn btn-primary" onclick="startProject('${project.sourceUrl}'); event.stopPropagation();">Start</button>`
      );
    }
  }

  if (project.status === "complete" && project.resultUrl) {
    buttons.push(
      `<a href="${project.resultUrl}" class="btn btn-primary" onclick="event.stopPropagation();">Results</a>`
    );
  }

  return buttons.join("");
}

function toggleProjectDetails(projectId) {
  const detailsRow = document.getElementById(`${projectId}-details`);
  const details = detailsRow.querySelector(".project-details");
  const isExpanded = details.classList.contains("active");

  // Close all other expanded rows
  document.querySelectorAll(".project-details.active").forEach((detail) => {
    if (detail !== details) {
      detail.classList.remove("active");
    }
  });

  // Toggle the clicked row
  details.classList.toggle("active");
}

function sortProjects(projects) {
  return projects.sort((a, b) => {
    let compareResult = 0;

    switch (currentSortColumn) {
      case "status":
        compareResult = a.status.localeCompare(b.status);
        break;
      case "name":
        compareResult = a.name.localeCompare(b.name);
        break;
      case "author":
        compareResult = a.author.localeCompare(b.author);
        break;
      case "language":
        compareResult = a.language.localeCompare(b.language);
        break;
      case "date":
        compareResult = a.file_timestamp - b.file_timestamp;
        break;
      case "datasites":
        compareResult = a.datasites.length - b.datasites.length;
        break;
    }

    return currentSortDirection === "asc" ? compareResult : -compareResult;
  });
}

// Project action functions
async function startProject(sourceUrl) {
  const url = `http://localhost:${serverPort}/apps/command/fedreduce`;
  const payload = {
    command: "start",
    source: sourceUrl,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      alert("Project started successfully!");
      fetchProjects();
    } else {
      alert("Failed to start project.");
    }
  } catch (error) {
    console.error("Error starting project:", error);
    alert("Error connecting to the server.");
  }
}

async function joinProject(sourceUrl) {
  const url = `http://localhost:${serverPort}/apps/command/fedreduce`;
  const payload = {
    command: "join",
    state: "join",
    source: sourceUrl,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      alert("Successfully joined project!");
      fetchProjects();
    } else {
      alert("Failed to join project.");
    }
  } catch (error) {
    console.error("Error joining project:", error);
    alert("Error connecting to the server.");
  }
}

async function leaveProject(sourceUrl) {
  const url = `http://localhost:${serverPort}/apps/command/fedreduce`;
  const payload = {
    command: "join",
    state: "leave",
    source: sourceUrl,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      alert("Successfully left project!");
      fetchProjects();
    } else {
      alert("Failed to leave project.");
    }
  } catch (error) {
    console.error("Error leaving project:", error);
    alert("Error connecting to the server.");
  }
}

function renderProjects(data, joinedProjects) {
  const allProjects = [
    ...data.invite.map((p) => ({ ...p, status: "invite" })),
    ...data.running.map((p) => ({ ...p, status: "running" })),
    ...data.complete.map((p) => ({ ...p, status: "complete" })),
  ];

  const sortedProjects = sortProjects(allProjects);
  const tbody = document.getElementById("projects-tbody");
  tbody.innerHTML = "";

  sortedProjects.forEach((project) => {
    const isJoined = joinedProjects.some(
      (p) => p.sourceUrl === project.sourceUrl
    );
    const isAuthor = metadataDatasite === project.author;
    const projectId = formatId(`${project.author}-${project.name}`);

    // Create main row
    const row = document.createElement("tr");
    row.onclick = () => toggleProjectDetails(projectId);

    const actionButtons = getActionButtons(project, isJoined, isAuthor);

    row.innerHTML = `
          <td>
              <span class="status-badge ${project.status}">
                  ${statusEmojis[project.status]} ${capitalizeFirst(
      project.status
    )}
              </span>
          </td>
          <td>${project.name}</td>
          <td>${project.author}</td>
          <td><span class="language-tag">${project.language}</span></td>
          <td>${formatDate(project.file_timestamp * 1000)}</td>
          <td>${project.datasites.length} sites</td>
          <td class="actions-cell">
              <div class="action-buttons">
                  ${actionButtons}
              </div>
          </td>
      `;

    // Create details row
    const detailsRow = document.createElement("tr");
    detailsRow.id = `${projectId}-details`;

    // Format code files section - updated version
    const codeFiles = project.code
      ? Object.entries(project.code)
          .map(([filename, path]) => {
            const fileEmoji = getFileEmoji(filename);
            return `
              <li class="code-file">
                  <a href="${path}" target="_blank" class="code-file-link" onclick="event.stopPropagation()">
                      ${fileEmoji} ${filename}
                  </a>
              </li>`;
          })
          .join("")
      : "No code files available";

    detailsRow.innerHTML = `
      <td colspan="7">
        <div class="project-details">
          <div class="details-grid">
            <div class="detail-section">
              <h3>📝 Description</h3>
              <p>${project.description}</p>
            </div>
            <div class="detail-section">
              <h3>
                <a href="${
                  project.sourceUrl
                }" target="_blank" onclick="event.stopPropagation()" style="text-decoration: none; color: inherit;">
                  📂 Code Files
                </a>
              </h3>
              <ul class="code-files-list">
                ${codeFiles}
              </ul>
            </div>
            <div class="detail-section">
              <h3>🖥️ Datasites</h3>
              <ul class="datasites-list">
                ${project.datasites.map((site) => `<li>${site}</li>`).join("")}
              </ul>
            </div>
            <div class="detail-section">
              <h3>🔄 Shared Inputs</h3>
              <div class="shared-inputs">
                <div class="shared-inputs-header">
                  <span>📥 Input Configuration</span>
                </div>
                <div class="shared-inputs-content">
                  ${project.sharedInputs || "No shared inputs defined"}
                </div>
              </div>
            </div>
          </div>

          ${
            project.status !== "invite"
              ? `
            <div class="log-tabs-container" id="logs-${projectId}">
              <h3>📊 Logs</h3>
              <div class="tabs" id="tabs-${projectId}">
                <div class="tab-container">
                  <button class="tab-link active" onclick="openLogTab(event, 'shared-log-${projectId}')">
                    <span class="tab-icon">📋</span> Shared Log
                  </button>
                </div>
                ${project.datasites
                  .map(
                    (datasite) => `
                    <div class="tab-container">
                      <button class="tab-link" onclick="openLogTab(event, '${formatId(
                        datasite
                      )}-log-${projectId}')">
                        <span class="tab-icon">📝</span> ${datasite}
                      </button>
                      <a 
                        href="/datasites/${datasite}/fedreduce/${
                      project.status
                    }/${project.author}/${project.name}.yaml.log" 
                        class="log-file-link" 
                        target="_blank"
                        title="View raw log file"
                        onclick="event.stopPropagation();"
                      >
                        📄
                      </a>
                    </div>
                  `
                  )
                  .join("")}
              </div>
              <div id="log-content-${projectId}" class="log-content">
                <div id="shared-log-${projectId}" class="log-viewer active"></div>
                ${project.datasites
                  .map(
                    (datasite) => `
                    <div id="${formatId(
                      datasite
                    )}-log-${projectId}" class="log-viewer"></div>
                  `
                  )
                  .join("")}
              </div>
            </div>`
              : ""
          }
        </div>
      </td>
    `;

    tbody.appendChild(row);
    tbody.appendChild(detailsRow);
    detailsRow.style.display = "none"; // Hide details row by default

    if (project.status === "running" || project.status === "complete") {
      renderLogsForProject(project);
    }
  });
}

// Updated log tab handling
function openLogTab(event, logId) {
  event.stopPropagation(); // Prevent row toggle

  const logContent = event.currentTarget.closest(".log-tabs-container");
  const tabLinks = logContent.querySelectorAll(".tab-link");
  const logViewers = logContent.querySelectorAll(".log-viewer");

  // Hide all viewers and deactivate all tabs
  logViewers.forEach((viewer) => viewer.classList.remove("active"));
  tabLinks.forEach((tab) => tab.classList.remove("active"));

  // Activate selected tab and viewer
  event.currentTarget.classList.add("active");
  document.getElementById(logId).classList.add("active");
}

function toggleProjectDetails(projectId) {
  const detailsRow = document.getElementById(`${projectId}-details`);

  // First, close all other detail rows
  document.querySelectorAll('[id$="-details"]').forEach((row) => {
    if (row.id !== `${projectId}-details`) {
      row.style.display = "none";
      row.querySelector(".project-details")?.classList.remove("active");
    }
  });

  // Now toggle the clicked row
  if (detailsRow) {
    const details = detailsRow.querySelector(".project-details");
    const isCurrentlyOpen = detailsRow.style.display === "table-row";

    if (isCurrentlyOpen) {
      detailsRow.style.display = "none";
      details?.classList.remove("active");
    } else {
      detailsRow.style.display = "table-row";
      details?.classList.add("active");
    }
  }
}

function renderLogsForProject(project) {
  const { author, name, datasites, status } = project;
  const projectId = formatId(`${author}-${name}`);
  console.log("Starting log refresh for:", projectId, author, name, status);

  // Clear any existing intervals for this project
  clearLogIntervals(projectId);

  // Initialize shared log content as an array of objects with timestamps
  const sharedLogContent = [];
  const sharedLogId = `shared-log-${projectId}`;

  // Function to fetch logs for a single datasite
  const fetchDataSiteLogs = async (datasite) => {
    const logId = `${formatId(datasite)}-log-${projectId}`;
    const logUrl = `/datasites/${datasite}/fedreduce/${status}/${author}/${name}.yaml.log`;

    try {
      await fetchLogContent(
        logId,
        logUrl,
        datasite,
        sharedLogContent,
        sharedLogId
      );
    } catch (error) {
      console.error(`Error fetching logs for ${datasite}:`, error);
    }
  };

  // Different behavior based on project status
  if (status === "running") {
    // For running projects, set up intervals for real-time updates
    datasites.forEach((datasite) => {
      const logId = `${formatId(datasite)}-log-${projectId}`;
      const logUrl = `/datasites/${datasite}/fedreduce/running/${author}/${name}.yaml.log`;

      logIntervals[logId] = setInterval(async () => {
        await fetchLogContent(
          logId,
          logUrl,
          datasite,
          sharedLogContent,
          sharedLogId
        );
      }, 1000);
    });
  } else if (status === "complete" && !completedProjectLogs.has(projectId)) {
    // For completed projects, fetch logs once if not already fetched
    completedProjectLogs.add(projectId);

    // Fetch logs for all datasites once
    Promise.all(datasites.map(fetchDataSiteLogs)).catch((error) =>
      console.error("Error fetching completed project logs:", error)
    );
  }
}

async function fetchLogContent(
  logId,
  logUrl,
  datasite,
  sharedLogContent,
  sharedLogId
) {
  try {
    const response = await fetch(logUrl);
    if (response.ok) {
      const text = await response.text();
      const lines = text.trim().split("\n");
      let individualLogs = [];

      lines.forEach((line) => {
        try {
          const logEntry = JSON.parse(line);
          const formattedLine = `[${logEntry.timestamp}] ${datasite}: ${logEntry.message}`;

          individualLogs.push({
            timestamp: new Date(logEntry.timestamp).getTime(),
            line: formattedLine,
          });

          // Only add to shared log content if not already present
          if (!sharedLogContent.some((entry) => entry.line === formattedLine)) {
            sharedLogContent.push({
              timestamp: new Date(logEntry.timestamp).getTime(),
              line: formattedLine,
            });
          }
        } catch (error) {
          console.error("Failed to parse JSON log line:", line, error);
        }
      });

      // Sort logs by timestamp
      individualLogs.sort((a, b) => a.timestamp - b.timestamp);
      sharedLogContent.sort((a, b) => a.timestamp - b.timestamp);

      // Update individual datasite log
      const individualLogViewer = document.getElementById(logId);
      if (individualLogViewer) {
        individualLogViewer.textContent = individualLogs
          .map((entry) => entry.line)
          .join("\n");
      }

      // Update shared log
      const sharedLogViewer = document.getElementById(sharedLogId);
      if (sharedLogViewer) {
        sharedLogViewer.textContent = sharedLogContent
          .map((entry) => entry.line)
          .join("\n");

        // Auto-scroll to bottom only for running projects
        const projectStatus = sharedLogId
          .closest(".project-details")
          ?.querySelector(".status-badge")?.textContent;
        if (projectStatus?.includes("Running")) {
          if (
            sharedLogViewer.scrollTop + sharedLogViewer.clientHeight ===
            sharedLogViewer.scrollHeight
          ) {
            sharedLogViewer.scrollTop = sharedLogViewer.scrollHeight;
          }
        }
      }
    } else {
      console.error("Failed to fetch log:", logId);
    }
  } catch (error) {
    console.error("Error fetching log:", error);
  }
}

// Helper to escape HTML
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clearLogIntervals(projectId) {
  Object.keys(logIntervals).forEach((intervalId) => {
    if (intervalId.includes(projectId)) {
      clearInterval(logIntervals[intervalId]);
      delete logIntervals[intervalId];
    }
  });
}

// Function to pause/resume log updates
function toggleLogUpdates(projectId) {
  const isPaused = !logIntervals[projectId];

  if (isPaused) {
    // Resume updates
    renderLogsForProject(project);
  } else {
    // Pause updates
    clearLogIntervals(projectId);
  }

  // Update UI to show current state
  const toggleButton = document.querySelector(`#toggle-logs-${projectId}`);
  if (toggleButton) {
    toggleButton.textContent = isPaused ? "Pause Updates" : "Resume Updates";
    toggleButton.classList.toggle("paused", !isPaused);
  }
}

// Function to download logs
function downloadLogs(projectId, logType = "shared") {
  const logContent = document.getElementById(
    `${logType}-log-${projectId}`
  ).textContent;
  const project = document.querySelector(
    `#${projectId}-details .project-title`
  ).textContent;

  // Create blob and trigger download
  const blob = new Blob([logContent], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project}-${logType}-logs.txt`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Function to clear log content
function clearLogContent(logId) {
  const logViewer = document.getElementById(logId);
  if (logViewer) {
    logViewer.textContent = "";
  }
}

// Function to handle log search
function searchLogs(projectId, searchTerm) {
  const logViewers = document.querySelectorAll(
    `#logs-${projectId} .log-viewer`
  );

  logViewers.forEach((viewer) => {
    const text = viewer.textContent;
    const lines = text.split("\n");

    const highlightedText = lines
      .map((line) => {
        if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
          return `<span class="highlight">${line}</span>`;
        }
        return line;
      })
      .join("\n");

    viewer.innerHTML = highlightedText;
  });
}

// Utility function to format log timestamp
function formatLogTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

// File type to emoji mapping function
function getFileEmoji(filename) {
  const extension = filename.split(".").pop().toLowerCase();

  // Comprehensive mapping of file types to emojis
  const emojiMap = {
    // Programming Languages
    py: "🐍", // Python
    ipynb: "📓", // Jupyter Notebook
    js: "📜", // JavaScript
    jsx: "⚛️", // React
    ts: "💪", // TypeScript
    tsx: "⚛️", // React TypeScript
    html: "🌐", // HTML
    css: "🎨", // CSS
    scss: "🎨", // SCSS
    sass: "🎨", // SASS
    java: "☕", // Java
    cpp: "⚡", // C++
    c: "⚡", // C
    cs: "🎮", // C#
    rb: "💎", // Ruby
    php: "🐘", // PHP
    swift: "🍎", // Swift
    kt: "📱", // Kotlin
    go: "🐹", // Go
    rs: "🦀", // Rust
    r: "📊", // R

    // Data & Config Files
    json: "📋", // JSON
    yaml: "📄", // YAML
    yml: "📄", // YML
    xml: "📰", // XML
    csv: "📊", // CSV
    xls: "📗", // Excel
    xlsx: "📗", // Excel
    sql: "🗄️", // SQL
    db: "🗄️", // Database
    sqlite: "🗄️", // SQLite

    // Documentation & Text
    md: "📝", // Markdown
    txt: "📄", // Text
    pdf: "📕", // PDF
    doc: "📘", // Word
    docx: "📘", // Word
    rtf: "📄", // Rich Text

    // Other Common Files
    sh: "💻", // Shell Script
    bash: "💻", // Bash Script
    zsh: "💻", // ZSH Script
    env: "🔒", // Environment Variables
    gitignore: "👁️", // Git Ignore
    dockerfile: "🐋", // Docker
    lock: "🔒", // Lock Files
    toml: "⚙️", // TOML Config
    ini: "⚙️", // INI Config
    cfg: "⚙️", // Config File
    log: "📋", // Log File
  };

  // Return mapped emoji or default document emoji
  return emojiMap[extension] || "📄";
}