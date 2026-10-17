
const $ = (selector) => document.querySelector(selector);

const STORAGE_KEY = "taskflow-tasks-v1";

const elements = {
  modal: $("#taskModal"),
  form: $("#taskForm"),
  title: $("#taskTitle"),
  description: $("#taskDescription"),
  priority: $("#taskPriority"),
  status: $("#taskStatus"),
  dueDate: $("#taskDueDate"),
  search: $("#searchInput"),
  priorityFilter: $("#priorityFilter"),
  sort: $("#sortSelect")
};

let tasks = loadTasks();
let editingId = null;
let currentView = "all";

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.filter(task =>
          task &&
          typeof task.id === "string" &&
          typeof task.title === "string" &&
          ["todo", "progress", "done"].includes(task.status) &&
          ["low", "medium", "high"].includes(task.priority)
        )
      : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    alert("Could not save tasks. Check your browser storage.");
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "No due date";

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isOverdue(task) {
  return task.status !== "done" &&
    Boolean(task.dueDate) &&
    task.dueDate < todayString();
}

function openForm(task = null) {
  editingId = task ? task.id : null;
  elements.form.reset();

  $("#formTitle").textContent = task ? "Edit Task" : "Create a Task";
  $("#saveTaskBtn").textContent = task ? "Update Task" : "Save Task";

  elements.title.value = task?.title || "";
  elements.description.value = task?.description || "";
  elements.priority.value = task?.priority || "medium";
  elements.status.value = task?.status || "todo";
  elements.dueDate.value = task?.dueDate || "";

  elements.modal.hidden = false;
  elements.title.focus();
}

function closeForm() {
  elements.modal.hidden = true;
  editingId = null;
}

function renderTasks() {
  const query = elements.search.value.trim().toLowerCase();
  const priority = elements.priorityFilter.value;
  const sortBy = elements.sort.value;

  let visibleTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(query) ||
      (task.description || "").toLowerCase().includes(query);

    const matchesPriority =
      priority === "all" || task.priority === priority;

    const matchesView =
      currentView === "all" ||
      (currentView === "today" &&
        task.status !== "done" &&
        task.dueDate === todayString()) ||
      (currentView === "completed" && task.status === "done");

    return matchesSearch && matchesPriority && matchesView;
  });

  const priorityOrder = { high: 3, medium: 2, low: 1 };

  visibleTasks.sort((a, b) => {
    if (sortBy === "due") {
      return (a.dueDate || "9999-12-31")
        .localeCompare(b.dueDate || "9999-12-31");
    }

    if (sortBy === "priority") {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }

    return b.createdAt - a.createdAt;
  });

  const columns = {
    todo: $("#todoList"),
    progress: $("#progressList"),
    done: $("#doneList")
  };

  Object.values(columns).forEach(column => {
    column.innerHTML = "";
  });

  const counts = { todo: 0, progress: 0, done: 0 };

  visibleTasks.forEach(task => {
    counts[task.status]++;
    columns[task.status].insertAdjacentHTML(
      "beforeend",
      createTaskCard(task)
    );
  });

  Object.entries(columns).forEach(([status, column]) => {
    if (!counts[status]) {
      column.innerHTML = '<p class="empty-state">No tasks here yet.<br>Stay productive!</p>';
    }
  });

  $("#todoCount").textContent = counts.todo;
  $("#progressCount").textContent = counts.progress;
  $("#doneCount").textContent = counts.done;

  $("#totalStat").textContent = tasks.length;
  $("#progressStat").textContent =
    tasks.filter(task => task.status === "progress").length;
  $("#completedStat").textContent =
    tasks.filter(task => task.status === "done").length;
  $("#overdueStat").textContent =
    tasks.filter(isOverdue).length;

  $("#allCount").textContent = tasks.length;

  const titles = {
    all: "My Tasks",
    today: "Due Today",
    completed: "Completed Tasks"
  };

  $("#pageTitle").textContent = titles[currentView];
}

function createTaskCard(task) {
  const overdue = isOverdue(task);

  let nextAction = "";
  if (task.status === "todo") {
    nextAction = `<button data-action="progress" data-id="${escapeHTML(task.id)}">Start</button>`;
  } else if (task.status === "progress") {
    nextAction = `<button data-action="todo" data-id="${escapeHTML(task.id)}">To Do</button>
      <button data-action="done" data-id="${escapeHTML(task.id)}">Complete</button>`;
  } else {
    nextAction = `<button data-action="todo" data-id="${escapeHTML(task.id)}">Reopen</button>`;
  }

  return `
    <article class="task-card">
      <span class="priority ${task.priority}">
        ${escapeHTML(task.priority)} priority
      </span>

      <h4>${escapeHTML(task.title)}</h4>

      ${task.description
        ? `<p class="description">${escapeHTML(task.description)}</p>`
        : ""}

      <p class="due-date ${overdue ? "overdue" : ""}">
        ${overdue ? "⚠ Overdue · " : "◷ "}
        ${escapeHTML(formatDate(task.dueDate))}
      </p>

      <div class="task-actions">
        ${nextAction}
        <button data-action="edit" data-id="${escapeHTML(task.id)}">Edit</button>
        <button data-action="delete" data-id="${escapeHTML(task.id)}">Delete</button>
      </div>
    </article>
  `;
}

elements.form.addEventListener("submit", event => {
  event.preventDefault();

  const title = elements.title.value.trim();
  if (!title) {
    elements.title.focus();
    return;
  }

  const taskData = {
    title,
    description: elements.description.value.trim(),
    priority: elements.priority.value,
    status: elements.status.value,
    dueDate: elements.dueDate.value
  };

  if (editingId) {
    tasks = tasks.map(task =>
      task.id === editingId ? { ...task, ...taskData } : task
    );
  } else {
    tasks.push({
      id: crypto.randomUUID(),
      ...taskData,
      createdAt: Date.now()
    });
  }

  saveTasks();
  closeForm();
  renderTasks();
});

$("#openFormBtn").addEventListener("click", () => openForm());
$("#closeFormBtn").addEventListener("click", closeForm);
$("#cancelBtn").addEventListener("click", closeForm);

elements.modal.addEventListener("click", event => {
  if (event.target === elements.modal) closeForm();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !elements.modal.hidden) closeForm();
});

Object.values(elements).forEach(element => {
  if (element === elements.modal || element === elements.form ||
      element === elements.title || element === elements.description ||
      element === elements.priority || element === elements.status ||
      element === elements.dueDate) return;

  element.addEventListener("input", renderTasks);
  element.addEventListener("change", renderTasks);
});

$("#clearSearchBtn").addEventListener("click", () => {
  elements.search.value = "";
  elements.priorityFilter.value = "all";
  elements.sort.value = "newest";
  renderTasks();
});

document.querySelector(".sidebar").addEventListener("click", event => {
  const button = event.target.closest("[data-view]");
  if (!button) return;

  currentView = button.dataset.view;

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item === button);
  });

  renderTasks();
});

document.querySelector(".board").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  const task = tasks.find(item => item.id === id);

  if (!task) return;

  if (action === "edit") {
    openForm(task);
  } else if (action === "delete") {
    if (!confirm(`Delete "${task.title}"?`)) return;
    tasks = tasks.filter(item => item.id !== id);
    saveTasks();
    renderTasks();
  } else if (["todo", "progress", "done"].includes(action)) {
    task.status = action;
    saveTasks();
    renderTasks();
  }
});

$("#todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

renderTasks();
