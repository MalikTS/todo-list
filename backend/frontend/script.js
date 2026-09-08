const $ = (id) => document.getElementById(id);
const icons = {
  layers:
    '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  circle: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  clipboard:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6m-6 4h4"/>',
  chart: '<path d="M4 19V5m0 14h16M8 15v-4m5 4V7m5 8V4"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  logout: '<path d="M9 4H4v16h5m5-13 5 5-5 5M9 12h11"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
}
document.querySelectorAll("[data-icon]").forEach((el) => {
  el.innerHTML = icon(el.dataset.icon);
});
const state = {
  tasks: [],
  filter: "all",
  query: "",
  loading: false,
  loaded: false,
  editTask: null,
  session: 0,
  revision: 0,
  busy: new Set(),
};
let toastTimer;
function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.add("hidden"), 3500);
}
function switchTab(tab) {
  const login = tab === "login";
  $("login-form").classList.toggle("hidden", !login);
  $("register-form").classList.toggle("hidden", login);
  for (const [id, selected] of [
    ["tab-login", login],
    ["tab-register", !login],
  ]) {
    $(id).classList.toggle("active", selected);
    $(id).setAttribute("aria-pressed", selected);
  }
  $("auth-title").textContent = login
    ? "С возвращением"
    : "Начните с чистого листа";
  $("auth-description").textContent = login
    ? "Ваши планы уже ждут вас."
    : "Создайте место для своих планов.";
  $("auth-error").textContent = "";
  $("auth-error").classList.remove("success");
}
$("tab-login").onclick = () => switchTab("login");
$("tab-register").onclick = () => switchTab("register");
document.querySelectorAll(".password-toggle").forEach(
  (button) =>
    (button.onclick = () => {
      const input = $(button.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute(
        "aria-label",
        show ? "Скрыть пароль" : "Показать пароль",
      );
      button.setAttribute("aria-pressed", show);
    }),
);
function updateDate() {
  $("today").textContent = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  }).format(new Date());
}
updateDate();
setInterval(updateDate, 60000);
function showAuth() {
  const authenticated = !!localStorage.getItem("access_token");
  $("auth-section").classList.toggle("hidden", authenticated);
  $("tasks-section").classList.toggle("hidden", !authenticated);
  $("logout-btn").classList.toggle("hidden", !authenticated);
  const username = localStorage.getItem("focus_username") || "Мой аккаунт";
  $("profile-name").textContent = authenticated
    ? username
    : "Ваше пространство";
  $("profile-caption").textContent = authenticated
    ? "Личный аккаунт"
    : "Начните с первой задачи";
  $("avatar").textContent = authenticated ? username[0].toUpperCase() : "Ф";
  $("page-breadcrumb").textContent = authenticated
    ? "Все задачи"
    : "Добро пожаловать";
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.disabled = !authenticated;
  });
  if (authenticated) loadTasks();
}
function signOut() {
  state.session++;
  state.tasks = [];
  state.loaded = false;
  state.loading = false;
  state.filter = "all";
  state.query = "";
  state.busy.clear();
  localStorage.removeItem("access_token");
  localStorage.removeItem("focus_username");
  $("search-tasks").value = "";
  $("task-form").reset();
  $("edit-dialog").close();
  state.editTask = null;
  renderTasks();
  showAuth();
}
$("logout-btn").onclick = () => {
  signOut();
  switchTab("login");
};
function errorMessage(detail, fallback) {
  const messages = {
    "Incorrect username or password": "Проверьте имя пользователя и пароль.",
    "Username already registered": "Это имя уже занято. Попробуйте другое.",
    "Could not validate credentials": "Сессия истекла. Войдите ещё раз.",
    "Task not found": "Задача не найдена. Обновите список.",
  };
  return typeof detail === "string" ? messages[detail] || fallback : fallback;
}
async function request(
  endpoint,
  { method = "GET", body, form = false, authenticated = true } = {},
) {
  const headers = {
    "Content-Type": form
      ? "application/x-www-form-urlencoded"
      : "application/json",
  };
  const token = localStorage.getItem("access_token");
  if (authenticated && token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api${endpoint}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body !== undefined
        ? { body: form ? body : JSON.stringify(body) }
        : {}),
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (
        response.status === 401 &&
        authenticated &&
        token === localStorage.getItem("access_token")
      ) {
        signOut();
        switchTab("login");
        $("auth-error").textContent = "Сессия истекла. Войдите ещё раз.";
      }
      throw new Error(
        errorMessage(
          data.detail,
          response.status >= 500
            ? "Сервер временно недоступен. Попробуйте ещё раз."
            : "Не удалось выполнить запрос. Проверьте данные и повторите.",
        ),
      );
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("Сервер долго не отвечает. Попробуйте ещё раз.");
    if (error instanceof TypeError)
      throw new Error("Нет соединения с сервером. Проверьте подключение.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
async function submitAuth(event, register) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  if (button.disabled) return;
  const username = $(register ? "reg-username" : "login-username").value.trim();
  const password = $(register ? "reg-password" : "login-password").value;
  $("auth-error").classList.remove("success");
  $("auth-error").textContent = "";
  if (!username) {
    $("auth-error").textContent = "Введите имя пользователя.";
    return;
  }
  button.disabled = true;
  form.setAttribute("aria-busy", "true");
  $("tab-login").disabled = $("tab-register").disabled = true;
  try {
    if (register) {
      await request("/auth/register", {
        method: "POST",
        body: { username, password },
        authenticated: false,
      });
      form.reset();
      switchTab("login");
      $("login-username").value = username;
      $("auth-error").classList.add("success");
      $("auth-error").textContent =
        "Аккаунт создан! Введите пароль, чтобы войти.";
      $("login-password").focus();
    } else {
      const data = await request("/auth/token", {
        method: "POST",
        body: new URLSearchParams({ username, password }),
        form: true,
        authenticated: false,
      });
      if (!data.access_token)
        throw new Error("Сервер не вернул токен входа. Повторите попытку.");
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("focus_username", username);
      state.session++;
      form.reset();
      showAuth();
    }
  } catch (error) {
    $("auth-error").textContent = error.message;
  } finally {
    button.disabled = false;
    form.removeAttribute("aria-busy");
    $("tab-login").disabled = $("tab-register").disabled = false;
  }
}
$("login-form").onsubmit = (event) => submitAuth(event, false);
$("register-form").onsubmit = (event) => submitAuth(event, true);
function showTaskError(message) {
  $("task-error-text").textContent = message;
  $("task-error").classList.toggle("hidden", !message);
}
async function loadTasks() {
  if (state.loading || state.busy.size) return;
  const session = state.session;
  const revision = state.revision;
  state.loading = true;
  showTaskError("");
  renderTasks();
  try {
    const tasks = await request("/tasks/");
    if (session !== state.session || revision !== state.revision) return;
    if (!Array.isArray(tasks))
      throw new Error("Не удалось прочитать список задач.");
    state.tasks = tasks;
    state.loaded = true;
  } catch (error) {
    if (session === state.session) showTaskError(error.message);
  } finally {
    if (session === state.session) {
      state.loading = false;
      renderTasks();
    }
  }
}
$("retry-btn").onclick = loadTasks;
function renderTasks() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  for (const [id, value] of Object.entries({
    "nav-all": total,
    "nav-active": active,
    "nav-completed": completed,
    "stat-total": total,
    "stat-active": active,
    "stat-completed": completed,
    "progress-value": `${percent}%`,
    "progress-fraction": `${completed} из ${total}`,
  }))
    $(id).textContent = value;
  $("progress-ring").style.setProperty("--progress", `${percent}%`);
  $("progress-title").textContent = !total
    ? "Начало чего-то хорошего"
    : active
      ? "Каждый шаг имеет значение"
      : "Отличная работа!";
  $("progress-description").textContent = !total
    ? "Добавьте задачу и сделайте первый шаг."
    : active
      ? "Продолжайте в своём темпе. Вы движетесь вперёд."
      : "Все задачи выполнены. Самое время выдохнуть.";
  const labels = {
    all: "Все задачи",
    active: "В процессе",
    completed: "Завершённые",
  };
  $("task-heading").textContent = labels[state.filter];
  const dot = document.createElement("span");
  dot.className = "accent";
  dot.textContent = ".";
  $("task-heading").append(dot);
  if (localStorage.getItem("access_token"))
    $("page-breadcrumb").textContent = labels[state.filter];
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const selected = button.dataset.filter === state.filter;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected);
  });
  const tasks = state.tasks
    .filter(
      (task) =>
        (state.filter === "all" ||
          task.completed === (state.filter === "completed")) &&
        task.title.toLocaleLowerCase("ru").includes(state.query),
    )
    .sort((a, b) => Number(a.completed) - Number(b.completed) || b.id - a.id);
  $("result-count").textContent = state.loaded
    ? `${tasks.length} из ${total}`
    : "";
  $("list-summary").textContent = total
    ? `Выполнено ${completed} из ${total} · Осталось ${active}`
    : "Всё начинается с первой задачи";
  $("loading-state").classList.toggle("hidden", !state.loading);
  $("tasks-list").classList.toggle("hidden", state.loading);
  $("tasks-list").replaceChildren();
  $("task-form").querySelector("button").disabled =
    state.loading || state.busy.has("create") || !state.loaded;
  const fragment = document.createDocumentFragment();
  tasks.forEach((task) => {
    const row = document.createElement("li");
    row.className = `task-row${task.completed ? " completed" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-checkbox";
    check.checked = task.completed;
    check.disabled = state.busy.has(task.id);
    check.setAttribute(
      "aria-label",
      `${task.completed ? "Вернуть в работу" : "Завершить"}: ${task.title}`,
    );
    check.dataset.taskId = task.id;
    check.onchange = () => mutateTask(task, "toggle");
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const actions = document.createElement("div");
    actions.className = "task-actions";
    for (const [name, label, action] of [
      ["edit", "Редактировать", () => openEdit(task)],
      ["trash", "Удалить", () => mutateTask(task, "delete")],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `icon-button${name === "trash" ? " delete" : ""}`;
      button.innerHTML = icon(name);
      button.setAttribute("aria-label", `${label}: ${task.title}`);
      button.title = label;
      button.disabled = state.busy.has(task.id);
      button.onclick = action;
      actions.append(button);
    }
    row.append(check, title);
    if (task.completed) {
      const badge = document.createElement("span");
      badge.className = "task-status";
      badge.textContent = "Готово";
      row.append(badge);
    }
    row.append(actions);
    fragment.append(row);
  });
  $("tasks-list").append(fragment);
  $("empty-state").classList.toggle(
    "hidden",
    state.loading || !state.loaded || tasks.length > 0,
  );
  $("empty-title").textContent = state.query
    ? "Ничего не нашлось"
    : state.filter === "completed"
      ? "Победы ещё впереди"
      : total
        ? "Всё сделано!"
        : "Место для новых планов";
  $("empty-description").textContent = state.query
    ? "Попробуйте другое слово или измените фильтр."
    : state.filter === "completed"
      ? "Завершите первую задачу — она появится здесь."
      : total
        ? "Активных задач нет. Можно отдохнуть или придумать что-то новое."
        : "Добавьте первую задачу — большой путь начинается с маленького шага.";
  $("empty-add").classList.toggle(
    "hidden",
    !!state.query || state.filter === "completed",
  );
}
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      state.filter = button.dataset.filter;
      renderTasks();
    }),
);
$("search-tasks").oninput = (event) => {
  state.query = event.target.value.trim().toLocaleLowerCase("ru");
  renderTasks();
};
function focusNewTask() {
  $("new-task-title").focus();
}
$("focus-new-task").onclick = focusNewTask;
$("empty-add").onclick = focusNewTask;
document.addEventListener("keydown", (event) => {
  if (
    event.key.toLowerCase() === "n" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.target.closest('input,textarea,select,[contenteditable="true"]') &&
    !$("tasks-section").classList.contains("hidden") &&
    !$("edit-dialog").open
  ) {
    event.preventDefault();
    focusNewTask();
  }
});
$("task-form").onsubmit = async (event) => {
  event.preventDefault();
  const input = $("new-task-title");
  const title = input.value.trim();
  const session = state.session;
  if (!title) {
    input.setCustomValidity("Введите название задачи.");
    input.reportValidity();
    return;
  }
  if (state.loading || !state.loaded || state.busy.has("create")) return;
  state.busy.add("create");
  renderTasks();
  showTaskError("");
  try {
    const task = await request("/tasks/", {
      method: "POST",
      body: { title, completed: false },
    });
    if (session !== state.session) return;
    state.revision++;
    state.tasks.push(task);
    input.value = "";
    state.filter = "all";
    state.query = "";
    $("search-tasks").value = "";
    notify("Задача добавлена");
    input.focus();
  } catch (error) {
    if (session === state.session) showTaskError(error.message);
  } finally {
    if (session === state.session) {
      state.busy.delete("create");
      renderTasks();
    }
  }
};
$("new-task-title").oninput = (event) => event.target.setCustomValidity("");
async function mutateTask(task, action, title) {
  if (!task || state.loading || state.busy.has(task.id)) return false;
  const session = state.session;
  state.busy.add(task.id);
  showTaskError("");
  renderTasks();
  try {
    if (action === "delete") {
      await request(`/tasks/${task.id}`, { method: "DELETE" });
      if (session !== state.session) return false;
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      notify("Задача удалена");
    } else {
      const updated = await request(`/tasks/${task.id}`, {
        method: "PUT",
        body: {
          title: title ?? task.title,
          completed: action === "toggle" ? !task.completed : task.completed,
        },
      });
      if (session !== state.session) return false;
      state.tasks = state.tasks.map((item) =>
        item.id === task.id ? updated : item,
      );
      notify(
        action === "edit"
          ? "Изменения сохранены"
          : updated.completed
            ? "Ещё одна задача выполнена!"
            : "Задача снова в работе",
      );
    }
    state.revision++;
    return true;
  } catch (error) {
    if (session === state.session) {
      if (action === "edit") $("edit-error").textContent = error.message;
      else showTaskError(error.message);
    }
    return false;
  } finally {
    if (session === state.session) {
      state.busy.delete(task.id);
      renderTasks();
      if (action === "toggle")
        document.querySelector(`[data-task-id="${task.id}"]`)?.focus();
    }
  }
}
function openEdit(task) {
  state.editTask = task;
  $("edit-title").value = task.title;
  $("edit-title").setCustomValidity("");
  $("edit-error").textContent = "";
  $("edit-dialog").showModal();
  $("edit-title").focus();
  $("edit-title").select();
}
$("close-edit").onclick = $("cancel-edit").onclick = () =>
  $("edit-dialog").close();
$("edit-title").oninput = (event) => event.target.setCustomValidity("");
$("edit-form").onsubmit = async (event) => {
  event.preventDefault();
  const title = $("edit-title").value.trim();
  if (!title) {
    $("edit-title").setCustomValidity("Введите название задачи.");
    $("edit-title").reportValidity();
    return;
  }
  const button = event.currentTarget.querySelector('[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  $("edit-error").textContent = "";
  try {
    if (await mutateTask(state.editTask, "edit", title))
      $("edit-dialog").close();
  } finally {
    button.disabled = false;
  }
};
renderTasks();
showAuth();
