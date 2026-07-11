# POVI Surat - Sistem Manajemen Surat

Frontend aplikasi manajemen surat digital untuk Fakultas Sains UM menggunakan React, Vite, Tailwind CSS, dan Supabase.

## 🎨 Design System

- **Color Theme**: Paper theme (cream/beige)
- **Primary Color**: Amber (#B45309)
- **Background**: Cream (#FFFEF9)
- **Font**: Public Sans (Google Fonts)
- **Framework**: Tailwind CSS

## 📁 Project Structure

```
povi-surat/
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.tsx      # Route protection wrapper
│   │   ├── TemplatePicker.tsx      # Template selector component
│   │   └── SuratForm.tsx           # Dynamic form based on template
│   ├── layouts/
│   │   └── MainLayout.tsx          # Sidebar + Header layout
│   ├── lib/
│   │   └── supabase.ts             # Supabase client & auth helpers
│   ├── pages/
│   │   ├── LoginPage.tsx           # Google OAuth login
│   │   ├── AuthCallbackPage.tsx    # OAuth callback handler
│   │   ├── Dashboard.tsx           # Home dashboard
│   │   ├── RequestSurat.tsx        # Create new letter form
│   │   ├── MonitoringSurat.tsx     # View submitted letters
│   │   └── ApprovalDashboard.tsx   # Approval interface (sekretaris)
│   ├── App.tsx                     # Main app component
│   ├── main.jsx                    # Entry point
│   ├── routes.tsx                  # React Router config
│   └── index.css                   # Global styles + Tailwind
├── index.html                      # HTML entry point
├── vite.config.js                  # Vite configuration
├── tailwind.config.js              # Tailwind configuration
├── postcss.config.js               # PostCSS configuration
├── package.json                    # Dependencies
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
└── README.md                       # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
cd povi-surat
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Add Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Running Development Server

```bash
npm run dev
```

Server akan berjalan di `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## 📋 Features Overview

### 1. **Authentication** (LoginPage)
- Google OAuth login via Supabase
- Automatic redirect on auth callback
- Protected routes for authenticated users

### 2. **Dashboard** (Dashboard)
- Welcome screen with quick stats
- Total letters, pending approvals, approved count
- Quick action buttons

### 3. **Create Letter** (RequestSurat)
- Template picker with visual cards
- Dynamic form based on selected template
- Placeholder replacement in Google Docs
- Real-time form validation

### 4. **Monitoring** (MonitoringSurat)
- Table view of submitted letters
- Filter by status (pending, approved, rejected)
- Direct link to Google Docs

### 5. **Approval Dashboard** (ApprovalDashboard)
- List of pending approvals
- Side panel for review
- Approve/Reject buttons
- Optional approval notes

### 6. **Layout** (MainLayout)
- Collapsible sidebar navigation
- Responsive header
- Role-based menu items
- Logout functionality

## 🔧 Component Details

### ProtectedRoute
Wraps routes that require authentication. Shows loading spinner while checking auth state.

```tsx
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

### TemplatePicker
Displays available surat templates with visual selection.

**Props:**
- `templates` - Array of available templates
- `selectedTemplate` - Currently selected template
- `onSelect` - Callback when template is selected

### SuratForm
Dynamic form that generates inputs based on template placeholders.

**Props:**
- `template` - Selected template object
- `onSubmit` - Callback with form data
- `loading` - Loading state for submit button

### MainLayout
Main layout wrapper with sidebar and header.

**Props:**
- `children` - Page content
- `userRole` - User role for menu filtering (requester/approver/admin)

## 🔗 API Integration Points

These endpoints need to be implemented on the backend:

1. **POST /api/generate-surat**
   - Create new surat from template
   - Replace placeholders
   - Set initial status

2. **POST /api/approve-surat**
   - Approve pending surat
   - Add approval notes
   - Update status to approved

3. **GET /api/surats**
   - List user's surats with filters
   - Paginated results

4. **GET /api/approval-queue**
   - List pending approvals for sekretaris
   - Sorted by date

## 🎯 Current Status

✅ **Completed:**
- UI skeleton and components
- Supabase auth integration
- React Router setup with protected routes
- Paper theme styling
- Responsive layout

⏳ **TODO:**
- API integration for letter generation
- API integration for approvals
- Database schema for storing surats
- Email notifications
- Document preview functionality
- Search and filtering

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📝 Notes

- All components use TypeScript for type safety
- Tailwind CSS for utility-first styling
- Lucide React icons for UI elements
- No API calls implemented yet (skeleton only)
- JWT verification disabled in backend for testing

## 🔐 Security

- Protected routes require authentication
- OAuth via Supabase (industry standard)
- Environment variables for sensitive data
- CORS enabled on backend

## 📚 Dependencies

- **react**: UI library
- **react-dom**: DOM rendering
- **react-router-dom**: Client-side routing
- **@supabase/supabase-js**: Supabase client
- **lucide-react**: Icon library
- **tailwindcss**: CSS framework
- **vite**: Build tool

## 👨‍💻 Development

### Adding a New Page

1. Create file in `src/pages/YourPage.tsx`
2. Wrap with `MainLayout` if needed
3. Add route in `src/routes.tsx`
4. Add navigation item in `MainLayout.tsx`

### Adding a New Component

1. Create file in `src/components/YourComponent.tsx`
2. Export as named export
3. Use in pages as needed

### Styling

Use Tailwind CSS classes. Custom components have predefined classes:
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.btn-outline` - Outline button
- `.card` - Card wrapper
- `.input-field` - Form input
- `.page-container` - Page wrapper

---

**Created**: July 2026
**Last Updated**: July 2026
