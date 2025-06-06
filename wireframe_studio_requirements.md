# Wireframe Studio - Project Requirements

## ✅ Project Name: **Wireframe Studio**

---

## 🔥 Objective:

Build a web-based application that allows users to create wireframes using a simple, custom DSL (Domain-Specific Language). As the user types into the editor on the **left pane**, the **right pane** should instantly render the corresponding **visual wireframe representation**.

This tool is similar in spirit to **Mermaid.js**, but specifically targeted at creating screen mockups and wireframes for apps and websites.

---

## 💻 Application Structure

### 🧩 Frontend Layout:

- **Two-pane layout:**
  - **Left Pane**: Code editor (syntax-aware for the DSL).
  - **Right Pane**: Real-time visual rendering of the wireframe.
- Optional: Toggle dark/light mode and download/export wireframe as image or code.

---

## 💡 DSL Syntax Specification

A minimal and readable language with the following base structure:

### Basic Syntax

\`\`\`
screen HomeScreen
  label "Welcome"
  input placeholder="Enter name"
  button "Continue"

screen LoginScreen
  image src="logo.png"
  input placeholder="Username"
  input placeholder="Password"
  button "Login"
\`\`\`

### Supported Components (initially):
- \`screen <ScreenName>\`
- \`label "Text"\`
- \`input [placeholder="<placeholderText>"]\`
- \`button "Text"\`
- \`image src="<url>"\`

Each `screen` defines a new page or section. The wireframe renderer should render one screen at a time (e.g., the first screen by default), or allow user to switch between screens.

---

## 🏗️ Functional Requirements

### Editor:
- Syntax-highlighted code editor (e.g., using **Monaco Editor** or **CodeMirror**).
- Error feedback if the DSL syntax is invalid.
- Auto-formatting and optional IntelliSense for DSL keywords.

### Renderer:
- Parse the DSL and render corresponding UI elements using HTML/CSS or a canvas-based renderer (like Konva.js).
- Layout:
  - Components stack vertically in the order they're defined.
  - Inputs and buttons use default styles unless extended in future.
- Responsive preview area (desktop/tablet toggle optional).

### Live Preview:
- Automatically re-render on every code change (debounced for performance).
- Option to switch between different defined `screen`s.

---

## 🧠 Non-Functional Requirements

- **Performance**: Preview must update within 300ms after typing.
- **Extensibility**: The DSL and renderer should be modular to allow adding features like `textarea`, `checkbox`, `dropdown`, etc.
- **Security**: Sanitize inputs (especially URLs) to avoid XSS.

---

## 🛠️ Tech Stack Suggestions

### Frontend
- React.js (for modular UI and state management)
- Code Editor: [Monaco Editor](https://microsoft.github.io/monaco-editor/) or [CodeMirror](https://codemirror.net/)
- Parser: Custom parser for DSL (can use PEG.js or hand-written)
- Renderer: HTML/CSS based DOM rendering or Canvas (e.g., [Konva.js](https://konvajs.org/))

---

## 📦 Future Enhancements (Not for MVP)

- Export to image or PDF
- Save/load wireframe projects
- Share wireframes via link
- Collaborate with others (multi-user editing)
- Add layout options (rows/columns/grids)

---

## 🎯 MVP Deliverables

1. Full web app with:
   - Two-pane layout
   - Working DSL parser
   - Basic wireframe renderer (label, input, button, image)
2. Live preview updates on code changes
3. Simple UI switch between screens
