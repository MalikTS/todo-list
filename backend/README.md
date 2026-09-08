```markdown
# Todo List - Fullstack Application

Учебный проект: список задач с авторизацией на JWT.

## Стек технологий

- Backend: FastAPI, SQLAlchemy, SQLite, bcrypt, python-jose
- Frontend: HTML, CSS, Vanilla JavaScript

## Структура проекта

```
backend/
├── app/                 # Основной код приложения
│   ├── routers/         # API маршруты (auth, tasks)
│   ├── main.py          # Точка входа
│   ├── models.py        # Модели SQLAlchemy
│   ├── schemas.py       # Pydantic схемы
│   ├── security.py      # JWT и хеширование паролей
│   └── database.py      # Подключение к SQLite
├── frontend/            # Статические файлы фронтенда
├── requirements.txt     # Зависимости Python
└── .gitignore
```

## Запуск проекта

### Требования

- Python 3.9 или выше
- Git

### Установка и запуск

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/MalikTS/todo-list.git
   cd todo-list
   ```

2. Перейдите в папку backend:
   ```bash
   cd backend
   ```

3. Создайте виртуальное окружение:
   ```bash
   python -m venv venv
   ```

4. Активируйте виртуальное окружение:
   - Windows:
     ```bash
     venv\Scripts\activate
     ```
   - macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

5. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

6. Запустите сервер:
   ```bash
   uvicorn app.main:app --reload
   ```

7. Откройте в браузере:
   ```
   http://127.0.0.1:8000
   ```

## API Endpoints

### Публичные
- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/token` - Получение JWT токена

### Защищённые (требуется Bearer token)
- `GET /api/tasks/` - Получить список задач
- `POST /api/tasks/` - Создать задачу
- `PUT /api/tasks/{id}` - Обновить задачу
- `DELETE /api/tasks/{id}` - Удалить задачу

## Документация API

Интерактивная документация доступна по адресу:
```
http://127.0.0.1:8000/docs
```
```




uvicorn app.main:app --reload --port 8001