import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from './components/auth/RouteGuards';
import { PublicLayout } from './layouts/PublicLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { LearningPathsPage } from './pages/LearningPathsPage';
import { LearningPathDetailPage } from './pages/LearningPathDetailPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomDetailPage } from './pages/RoomDetailPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="learning-paths" element={<LearningPathsPage />} />
          <Route path="learning-paths/:pathId" element={<LearningPathDetailPage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="rooms/:roomId" element={<RoomDetailPage />} />
          <Route
            path="challenges"
            element={
              <PlaceholderPage
                title="Challenges"
                description="Deliberate practice with concrete prompts and a place to attempt them."
                items={[
                  'Browse challenges by topic and difficulty',
                  'Attempt challenges in an isolated workspace',
                  'Review results and learn from feedback',
                ]}
              />
            }
          />
          <Route
            path="settings"
            element={
              <PlaceholderPage
                title="Profile & settings"
                description="Identity, preferences, and account controls for your workspace."
                items={[
                  'Profile details and public presence',
                  'Notification and editor preferences',
                  'Account security and session management',
                ]}
              />
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
