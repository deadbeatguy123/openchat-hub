# CompChat

CompChat is a full-stack AI-powered web application developed as a Project Implementation Task for Elective 2 at the University of Science and Technology of Southern Philippines. It serves as an AI chat hub where users can interact with multiple AI language models through one responsive interface.

The application follows a Bring Your Own Key (BYOK) approach, where users provide their own API key to access supported AI models. This gives users more control over their AI usage, model selection, and chat experience.

## Live Demo

https://compchat-hub.vercel.app/

## Repository

https://github.com/Anjeiro/CompChat

## Project Objectives

- Develop a functional AI-powered chat application using modern web technologies.
- Allow users to select from multiple AI models for their conversations.
- Implement user authentication and user data management using Supabase.
- Store and retrieve chat history and messages using a structured database.
- Deploy the application publicly using Vercel.
- Maintain a clean and collaborative GitHub repository.

## Features

- User registration and login
- API key input and management
- Multi-model AI chatbot support
- Real-time chat interface
- Chat history storage
- Personality presets for AI behavior customization
- Persistent user data using Supabase
- Responsive user interface

## Tech Stack

| Category | Technology |
|---|---|
| Frontend | React with TypeScript |
| Styling | Tailwind CSS |
| Backend / Database | Supabase |
| Authentication | Supabase Auth |
| AI Integration | External AI APIs using BYOK approach |
| Deployment | Vercel |
| Version Control | GitHub |

## System Architecture

CompChat uses a client-server architecture with three main layers:

1. **Frontend Layer**  
   The frontend is built using React, TypeScript, and Tailwind CSS. It handles the user interface, chat display, model selection, and input forms.

2. **Backend / Database Layer**  
   Supabase is used for authentication, database storage, and user-related data management.

3. **AI Layer**  
   AI responses are generated through external AI model APIs using the user's own API key.

## Database Tables

The system uses the following main database tables:

### Chats

Stores user chat sessions, chat titles, selected presets, and custom AI personality settings.

### Messages

Stores the conversation messages between the user and the AI model, including message content, role, model used, and version tracking.

### Personality Presets

Stores custom AI personality presets created by users, including preset name, model name, personality, background, and tone.

### Profiles

Stores public user profile information and user-related settings.

### Users

User authentication is handled through Supabase Auth, which manages user email, password, and session tokens.

## AI Component

The main AI feature of CompChat is its multi-model chatbot. Users can select an AI model and provide their own API key to access the selected model. When a message is sent, the application includes the conversation history to maintain context and sends the request to the selected AI model.

The AI response is displayed in the chat interface and saved in the database for future access.

## Personality Presets

CompChat allows users to create and apply personality presets. These presets customize how the AI responds by changing its personality, background, and tone. Examples include coding assistant, creative writer, formal assistant, or study helper.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Anjeiro/CompChat.git
```

### 2. Go to the project folder

```bash
cd CompChat
```

### 3. Install dependencies

```bash
bun install
```

### 4. Configure environment variables

Create a `.env` file and add the required Supabase configuration values.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not share private API keys publicly.

### 5. Run the development server

```bash
bun run dev
```

### 6. Open the application

Open the local development link shown in the terminal.

## Deployment

The project is deployed publicly using Vercel.

Live site: https://compchat-hub.vercel.app/

## Development Process

The project was developed through the following phases:

1. **Planning**  
   Requirements gathering, wireframing, and database schema design.

2. **Setup**  
   GitHub repository setup, Supabase configuration, and Vercel deployment setup.

3. **Core Development**  
   Development of authentication, chat interface, AI integration, and database operations.

4. **Testing**  
   Testing of login, chat functions, API key input, responsiveness, and error handling.

5. **Deployment and Documentation**  
   Final deployment, README preparation, and project documentation.

## AI Use Disclosure

AI coding tools were used during development to assist with boilerplate code generation, debugging, and implementation suggestions. All AI-generated content and code were reviewed, modified, and validated by the team before being included in the project.

## Team Members

| Name | Role |
|---|---|
| Edward Angelo Banguis | Leader |
| Marby Egnalig | Frontend Developer |
| Miguel Cecelio Z. Elican | README Contributor |
| Loraine Mae Piagola | Backend / AI Developer |
| Denver Jay B. Palabon | UI/UX Designer |
| Cristian Dave T. Gulay | QA / Documentation |

## Contributor Note

This README was added to provide a clearer project overview, setup guide, technology stack, AI component explanation, deployment link, development process summary, and team information.

## Academic Purpose

This project was created for academic purposes as part of the Elective 2 Project Implementation Task.
