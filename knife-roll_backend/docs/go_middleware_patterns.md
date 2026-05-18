# Go Middleware Patterns (for reference)

This document shows how the Express middleware patterns translate to Go's `net/http` style.

---

## Key Differences from Express

| Express | Go |
|---------|-----|
| `next(err)` passes error to error handler | Return error or write response directly |
| Error handler is 4-param middleware | Error handling is often inline or via wrapper |
| Middleware chain via `app.use()` | Middleware chain via wrapping `http.Handler` |

---

## 1. Regular Middleware Pattern

```go
// Logging middleware - wraps a handler
func loggingMiddleware(logger *slog.Logger, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        logger.Info("request", "method", r.Method, "path", r.URL.Path)
        next.ServeHTTP(w, r) // ← equivalent to next()
    })
}
```

---

## 2. Error-Handling Pattern

Go doesn't have a centralized error-handler middleware like Express. Instead:

### Option A: Return error from handler (cleanest)

```go
// Handler returns error, wrapper handles it
type AppHandler func(http.ResponseWriter, *http.Request) error

func (h AppHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    err := h(w, r)
    if err == nil {
        return
    }

    // Centralized error handling
    if appErr, ok := err.(*AppError); ok {
        http.Error(w, appErr.Message, appErr.StatusCode)
        return
    }

    http.Error(w, "internal server error", http.StatusInternalServerError)
}

// Custom error type
type AppError struct {
    StatusCode int
    Message    string
}

func (e *AppError) Error() string {
    return e.Message
}

// Usage in handler
func handlerLogin(w http.ResponseWriter, r *http.Request) error {
    if !authorized {
        return &AppError{StatusCode: http.StatusUnauthorized, Message: "unauthorized"}
    }
    // ...
    return nil
}
```

### Option B: Inline error handling (common in simple apps)

```go
func handler(w http.ResponseWriter, r *http.Request) {
    if !authorized {
        http.Error(w, "unauthorized", http.StatusUnauthorized) // ← handle inline
        return
    }
    // ...
}
```

---

## 3. JWT Auth Middleware

```go
type contextKey string

const UserContextKey contextKey = "user"

type UserPayload struct {
    ID    int    `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
    Admin bool   `json:"admin"`
}

// Auth middleware - wraps a handler
func authMiddleware(secret []byte, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        // Extract "Bearer <token>"
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        if tokenString == authHeader {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        // Verify token
        token, err := jwt.ParseWithClaims(tokenString, &UserPayload{}, func(token *jwt.Token) (interface{}, error) {
            return secret, nil
        })

        if err != nil || !token.Valid {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        // Attach payload to context (Go's equivalent of req.user)
        claims := token.Claims.(*UserPayload)
        ctx := context.WithValue(r.Context(), UserContextKey, claims)
        next.ServeHTTP(w, r.WithContext(ctx)) // ← continue with modified request
    })
}

// Handler retrieves user from context
func handlerStats(w http.ResponseWriter, r *http.Request) {
    user, ok := r.Context().Value(UserContextKey).(*UserPayload)
    if !ok {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }
    // Use user.ID, user.Email, etc.
}
```

---

## 4. Full Server Setup Example

```go
type server struct {
    logger *slog.Logger
    secret []byte
}

func (s *server) mountRoutes(mux *http.ServeMux) {
    // Public route
    mux.HandleFunc("GET /health", handlerHealth)

    // Protected routes (wrapped with auth middleware)
    mux.Handle("GET /api/stats", s.authMiddleware(http.HandlerFunc(handlerStats)))
    mux.Handle("POST /api/shorten", s.authMiddleware(http.HandlerFunc(handlerShorten)))

    // Apply logging middleware to all routes
    loggingWrapper := func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            s.logger.Info("request", "method", r.Method, "path", r.URL.Path)
            next.ServeHTTP(w, r)
        })
    }
    mux.Handle("/", loggingWrapper(mux))
}
```

---

## Summary: Express → Go Translation

| Express Pattern | Go Equivalent |
|-----------------|---------------|
| `next()` | `next.ServeHTTP(w, r)` |
| `next(err)` | Return error or write response directly |
| `req.user` | `r.Context().Value(UserContextKey)` |
| Error handler middleware | Custom `AppHandler` wrapper or inline handling |
| `app.use(middleware)` | Wrap handlers: `middleware(http.HandlerFunc(handler))` |
