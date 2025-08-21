# Sai Kaki Chat Application

## Overview

This is a full-stack chat application featuring Sai Kaki, an AI assistant with a sarcastic but helpful personality. The application uses React with TypeScript on the frontend, Express.js on the backend, and PostgreSQL with Drizzle ORM for data persistence. The chat interface is built with modern UI components from shadcn/ui and includes features like session management, message history, AI-powered responses with real-time data integration (time, location, weather), and optional web search enhancement.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation resolvers

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API with structured endpoints for chat sessions and messages
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes
- **Request Logging**: Custom middleware for API request logging and performance monitoring
- **Module Organization**: Clean separation between routes, storage, and services

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless database
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Centralized schema definitions with automatic TypeScript type generation
- **Migrations**: Drizzle Kit for database schema migrations
- **Fallback Storage**: In-memory storage implementation for development/testing

### Database Schema Design
- **Users Table**: Basic user management with username/password
- **Chat Sessions Table**: Session management with titles and timestamps
- **Chat Messages Table**: Message storage with role-based content (user/assistant)
- **Relationships**: Proper foreign key relationships between users, sessions, and messages

### AI Integration
- **OpenAI Integration**: GPT-4o model for generating sarcastic but helpful responses
- **Personality System**: Custom system prompt defining Sai Kaki's personality traits
- **Context Management**: Conversation history tracking for contextual responses
- **Temperature Control**: Higher temperature setting (0.8) for more creative/sarcastic outputs
- **Real-time Data Integration**: Automatic inclusion of current time, location, and weather data
- **IP-based Location**: User location detection for weather and timezone information

### External Dependencies

- **AI Services**: OpenAI API for chat completions using GPT-4o model
- **Database**: Neon PostgreSQL serverless database
- **Web Search**: DuckDuckGo Instant Answer API for enhancing responses with web data
- **Real-time Data**: ip-api.com for geolocation, wttr.in for weather information
- **UI Framework**: Radix UI primitives for accessible component foundation
- **Build Tools**: Vite for fast development and optimized production builds
- **Deployment**: Replit-specific plugins for development environment integration

## Recent Changes (August 20, 2025)

- **AI Assistant Rebranding**: Changed from "SnarkyBot" to "Sai Kaki" throughout the application
- **Real-time Data Integration**: Added automatic time, location, and weather information to AI responses
- **Enhanced User Experience**: AI now provides contextual information based on user's location and current conditions
- **IP Detection**: Implemented proper client IP detection with Express trust proxy configuration
- **Service Architecture**: Added new real-time data service for weather and location APIs
- **Location-Based Services**: Added nearby places search for restaurants, gas stations, hospitals, etc.
- **User Permission System**: Implemented browser geolocation with proper user consent flow
- **Timezone Accuracy**: Time display now uses user's actual timezone instead of UTC
- **Places Search**: OpenStreetMap integration for finding nearby points of interest
- **Privacy-First Design**: Location access requires explicit user permission and is cached locally
- **Mobile Responsive Design**: Optimized for both mobile and desktop with adaptive UI elements
- **Precise Distance Calculations**: Enhanced location queries to show exact distances (meters/kilometers)
- **Privacy Policy Modal**: Added comprehensive privacy policy popup for first-time visitors
- **Chess Integration**: Added Stockfish-powered chess engine for playing chess games
- **Cross-Platform Compatibility**: Ensured consistent experience across all device types