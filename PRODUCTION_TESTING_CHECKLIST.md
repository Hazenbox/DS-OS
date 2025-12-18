# Production Testing Checklist

**Last Updated**: December 2024  
**Purpose**: Comprehensive guide for testing all features in production

---

## 🔐 Authentication & User Management

### ✅ Test Authentication Methods
- [ ] **Email/Password Signup**
  - Create new account with email and password
  - Verify password requirements (min 8 characters)
  - Check email validation
  - Verify automatic tenant creation

- [ ] **Email/Password Login**
  - Login with valid credentials
  - Test invalid password error
  - Test non-existent email error
  - Verify session persistence

- [ ] **Google OAuth Login** ⚠️ **Recently Fixed**
  - Click "Sign in with Google" button
  - Complete OAuth flow in popup
  - Verify redirect to `/auth/callback/google` works
  - Check user info is saved correctly
  - Verify automatic tenant creation

- [ ] **GitHub OAuth Login**
  - Click "Sign in with GitHub" button
  - Complete OAuth flow
  - Verify user creation/login
  - Check profile data sync

- [ ] **Session Management**
  - Verify session persists after page refresh
  - Test logout functionality
  - Check session expiration (7 days)

---

## 🏢 Multi-Tenant & Project Management

### ✅ Test Tenant Isolation
- [ ] **Automatic Tenant Creation**
  - Verify new users get personal tenant
  - Check tenant name matches user email/name

- [ ] **Project Creation**
  - Create a new project
  - Verify project is scoped to your tenant
  - Check project appears in selector

- [ ] **Project Selection**
  - Switch between projects
  - Verify data isolation between projects
  - Check URL updates correctly

- [ ] **Project Member Management**
  - Invite members to project
  - Assign roles (Owner, Admin, Editor, Viewer)
  - Verify member appears in list
  - Test removing members
  - Check role-based permissions

- [ ] **Project Deletion**
  - Delete a project (requires typing "DELETE")
  - Verify confirmation flow
  - Check project is removed from list

---

## 🎨 Token Manager

### ✅ Test Token Management
- [ ] **Upload Token Files**
  - Upload JSON token file (Figma Variables format)
  - Verify file parsing
  - Check tokens appear in table
  - Test multiple file uploads

- [ ] **Token Visualization**
  - **Colors Tab**: View color swatches with contrast ratios
  - **Typography Tab**: 
    - See font families displayed
    - Check typography previews
    - Verify weight display (e.g., "Regular • 400")
    - Test sorting by hierarchy
  - **Spacing Tab**: View spacing visualizations
  - **Sizing Tab**: View sizing tokens
  - **Radius Tab**: View border radius tokens
  - **Shadow Tab**: View shadow tokens

- [ ] **Token Filtering**
  - Filter tokens by type
  - Search for specific tokens
  - Verify filter persistence

- [ ] **Multi-Mode Support**
  - Switch between light/dark/high-contrast modes
  - Verify token values change
  - Check mode-specific tokens display

- [ ] **Token Dependency Graph**
  - View dependency graph visualization
  - Check token relationships
  - Verify graph navigation

- [ ] **Font Management**
  - Upload font file (WOFF, WOFF2, TTF, OTF)
  - Import font from URL (Google Fonts, GitHub)
  - Verify font metadata extraction
  - Check font validation against token families
  - Test Google Fonts specimen URL parsing

- [ ] **File Management**
  - Toggle token files on/off
  - Rename token files
  - Delete token files
  - Verify changes reflect in token table

---

## 🤖 Component Builder

### ✅ Test Component Extraction
- [ ] **Figma URL Validation**
  - Enter valid Figma component URL
  - Test invalid URL error
  - Verify URL format validation

- [ ] **API Key Configuration** (Required)
  - Go to Settings
  - Add Figma Personal Access Token
  - Add Claude API Key
  - **Test Claude Connection** (new feature!)
    - Click "Test Connection" button
    - Verify success/error message
  - Check API key status indicators

- [ ] **Component Extraction**
  - Paste Figma component URL
  - Click "Extract & Build"
  - Monitor extraction progress
  - Verify extraction completes
  - Check IRS/IRT/IML extraction logs

- [ ] **Component Intelligence**
  - Verify component classification (Button, Input, etc.)
  - Check component category detection
  - Verify Radix UI primitive suggestions
  - Check ARIA attribute suggestions

- [ ] **Generated Code**
  - View generated TypeScript code
  - Check CSS styles with token variables
  - Verify type definitions from variants
  - Test code syntax highlighting

- [ ] **Live Preview**
  - View component in Preview tab
  - Test component rendering
  - Check responsive behavior
  - Verify token variables work

- [ ] **Code Editor**
  - Edit component code in Monaco Editor
  - Test code autocomplete
  - Verify syntax highlighting
  - Check code changes reflect in preview

- [ ] **Inspect Tab**
  - View component variables
  - Check props documentation
  - Verify variant information

- [ ] **Component Saving**
  - Save extracted component
  - Verify component appears in list
  - Test component retrieval
  - Check component metadata

- [ ] **URL Routing**
  - Navigate to component via URL
  - Verify component loads correctly
  - Check URL updates on navigation

---

## 📦 Release Manager

### ✅ Test Release Management
- [ ] **Create Release**
  - Create new release
  - Set version number
  - Add description/changelog
  - Select components to include

- [ ] **Release Status**
  - Check release status (draft, in_progress, published, failed)
  - Update release status
  - Verify status changes reflect

- [ ] **Release History**
  - View all releases
  - Filter by status
  - Check release details
  - Verify component inclusion

- [ ] **Pipeline Visualization**
  - View release pipeline
  - Check status indicators
  - Verify visual flow

---

## ✅ Approval Workflow

### ✅ Test Approval Process
- [ ] **Visual Comparison**
  - View side-by-side comparison
  - Test overlay view mode
  - Check zoom controls
  - Verify diff overlay display

- [ ] **Component Navigation**
  - Navigate between components
  - Check component list
  - Verify selection works

- [ ] **Approve/Reject Actions**
  - Approve a component
  - Reject a component with reason
  - Verify actions save
  - Check approval status updates

- [ ] **Release Approval**
  - Approve entire release
  - Verify all components approved
  - Check release status changes

---

## 📊 Dashboard

### ✅ Test Dashboard Features
- [ ] **Project Overview**
  - View project statistics
  - Check component count
  - Verify token count
  - See release count

- [ ] **Activity Timeline**
  - View activity feed
  - Check activity descriptions
  - Verify activity filtering
  - Test activity navigation

- [ ] **Recent Activity**
  - See recent actions
  - Check activity timestamps
  - Verify activity details

---

## ⚙️ Settings

### ✅ Test Settings
- [ ] **Theme Management**
  - Switch to Light mode
  - Switch to Dark mode
  - Test System preference
  - Verify theme persists on refresh

- [ ] **API Key Management**
  - Add Figma PAT
  - Add Claude API Key
  - Test Claude connection (new!)
  - Update API keys
  - Verify key status indicators

- [ ] **SSO Configuration** (if applicable)
  - Configure SSO provider
  - Test SSO login
  - Verify SSO settings save

---

## 🎯 Advanced Features (If Configured)

### ✅ Visual Diff Testing
- [ ] **Run Visual Diff**
  - Capture component screenshot
  - Compare with Figma reference
  - View diff results
  - Check pixel-perfect comparison

### ✅ Accessibility Testing
- [ ] **Run A11y Tests**
  - Run axe-core tests
  - View accessibility violations
  - Check ARIA attribute verification
  - Test keyboard navigation

### ✅ Storybook Generation
- [ ] **View Storybook**
  - Generate Storybook stories
  - View component stories
  - Test component controls
  - Check accessibility examples

---

## 🐛 Common Issues to Check

### ✅ Error Handling
- [ ] **Network Errors**
  - Test with network offline
  - Verify error messages display
  - Check error recovery

- [ ] **Invalid Input**
  - Test invalid form inputs
  - Verify validation messages
  - Check form submission blocking

- [ ] **Missing Configuration**
  - Test without API keys
  - Verify helpful error messages
  - Check configuration prompts

### ✅ Performance
- [ ] **Loading States**
  - Check skeleton loaders
  - Verify loading indicators
  - Test long-running operations

- [ ] **Real-time Updates**
  - Verify data syncs instantly
  - Test multi-user scenarios
  - Check reactive updates

---

## 📱 Responsive Design

### ✅ Test Responsive Layout
- [ ] **Mobile View** (< 768px)
  - Test sidebar collapse
  - Check mobile navigation
  - Verify touch interactions

- [ ] **Tablet View** (768px - 1024px)
  - Test layout adaptation
  - Check component sizing

- [ ] **Desktop View** (> 1024px)
  - Verify full layout
  - Check sidebar behavior
  - Test multi-column layouts

---

## 🔒 Security Testing

### ✅ Test Security Features
- [ ] **Tenant Isolation**
  - Verify users can't access other tenants' data
  - Test cross-tenant data access (should fail)
  - Check tenant-scoped queries

- [ ] **Role-Based Access**
  - Test different role permissions
  - Verify role hierarchy
  - Check unauthorized action blocking

- [ ] **Session Security**
  - Test session expiration
  - Verify logout clears session
  - Check session token security

---

## 🎨 UI/UX Testing

### ✅ Test User Experience
- [ ] **Navigation**
  - Test sidebar navigation
  - Check URL routing
  - Verify back/forward buttons
  - Test deep linking

- [ ] **Visual Design**
  - Check dark mode styling
  - Verify light mode styling
  - Test theme transitions
  - Check color contrast

- [ ] **Accessibility**
  - Test keyboard navigation
  - Check ARIA labels
  - Verify screen reader support
  - Test focus management

---

## 📝 Quick Test Scenarios

### Scenario 1: New User Flow
1. Sign up with email/password
2. Create first project
3. Upload token file
4. Extract component from Figma
5. Save component
6. Create release

### Scenario 2: OAuth User Flow
1. Sign in with Google
2. Verify tenant creation
3. Create project
4. Extract component
5. Test component preview

### Scenario 3: Team Collaboration
1. Create project
2. Invite team member
3. Assign role
4. Verify member can access project
5. Test role-based permissions

### Scenario 4: Token Management
1. Upload multiple token files
2. Toggle files on/off
3. View token visualizations
4. Check dependency graph
5. Export tokens

### Scenario 5: Component Extraction
1. Configure API keys
2. Test Claude connection
3. Extract component
4. View generated code
5. Edit and preview
6. Save component

---

## 🚨 Known Issues to Watch For

1. **Google OAuth 404** - Should be fixed with recent vercel.json update
2. **Claude API** - Fixed API version and model name
3. **Client-side Routing** - Catch-all rewrite added for SPA routing

---

## 📊 Success Criteria

### ✅ All Core Features Should:
- Load without errors
- Display correct data
- Save changes successfully
- Sync in real-time
- Handle errors gracefully
- Work in both light/dark modes

---

**Happy Testing! 🚀**

