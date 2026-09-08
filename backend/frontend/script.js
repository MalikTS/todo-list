const API_URL = "/api";

const authSection = document.getElementById("auth-section");
const tasksSection = document.getElementById("tasks-section");
const logoutBtn = document.getElementById("logout-btn");

const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authError = document.getElementById("auth-error");

function switchTab(tab) {
    authError.textContent = "";
    if (tab === "login") {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        loginForm.classList.remove("hidden");
        registerForm.classList.add("hidden");
    } else {
        tabRegister.classList.add("active");
        tabLogin.classList.remove("active");
        registerForm.classList.remove("hidden");
        loginForm.classList.add("hidden");
    }
}

tabLogin.addEventListener("click", () => switchTab("login"));
tabRegister.addEventListener("click", () => switchTab("register"));

function checkAuth() {
    const token = localStorage.getItem("access_token");
    if (token) {
        authSection.classList.add("hidden");
        tasksSection.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
        loadTasks();
    } else {
        authSection.classList.remove("hidden");
        tasksSection.classList.add("hidden");
        logoutBtn.classList.add("hidden");
    }
}

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("access_token");
    checkAuth();
});

async function apiRequest(endpoint, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json"
    };

    const token = localStorage.getItem("access_token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorData.detail || "Request failed");
    }

    if (response.status === 204) {
        return null;
    }

    return await response.json();
}

checkAuth();

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);
        
        const response = await fetch(`${API_URL}/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Login failed");
        }
        
        const data = await response.json();
        localStorage.setItem("access_token", data.access_token);
        loginForm.reset();
        checkAuth();
    } catch (error) {
        authError.textContent = error.message;
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;
    
    try {
        await apiRequest("/auth/register", "POST", { username, password });
        authError.textContent = "Регистрация успешна. Теперь войдите.";
        authError.style.color = "#555555";
        registerForm.reset();
        switchTab("login");
    } catch (error) {
        authError.style.color = "";
        authError.textContent = error.message;
    }
});

async function loadTasks() {
    try {
        const tasks = await apiRequest("/tasks/");
        renderTasks(tasks);
    } catch (error) {
        console.error("Failed to load tasks:", error);
        if (error.message.includes("Could not validate credentials")) {
            localStorage.removeItem("access_token");
            checkAuth();
        }
    }
}

function renderTasks(tasks) {
    const tasksList = document.getElementById("tasks-list");
    tasksList.innerHTML = "";
    
    tasks.forEach(task => {
        const li = document.createElement("li");
        
        const span = document.createElement("span");
        span.textContent = task.title;
        if (task.completed) {
            span.classList.add("completed");
        }
        
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "task-actions";
        
        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = task.completed ? "Активна" : "Выполнена";
        toggleBtn.addEventListener("click", () => updateTask(task.id, task.title, !task.completed));
        
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Удалить";
        deleteBtn.addEventListener("click", () => deleteTask(task.id));
        
        actionsDiv.appendChild(toggleBtn);
        actionsDiv.appendChild(deleteBtn);
        
        li.appendChild(span);
        li.appendChild(actionsDiv);
        tasksList.appendChild(li);
    });
}

document.getElementById("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("new-task-title");
    const title = titleInput.value.trim();
    
    if (!title) return;
    
    try {
        await apiRequest("/tasks/", "POST", { title, completed: false });
        titleInput.value = "";
        loadTasks();
    } catch (error) {
        console.error("Failed to create task:", error);
    }
});

async function updateTask(taskId, title, completed) {
    try {
        await apiRequest(`/tasks/${taskId}`, "PUT", { title, completed });
        loadTasks();
    } catch (error) {
        console.error("Failed to update task:", error);
    }
}

async function deleteTask(taskId) {
    try {
        await apiRequest(`/tasks/${taskId}`, "DELETE");
        loadTasks();
    } catch (error) {
        console.error("Failed to delete task:", error);
    }
}