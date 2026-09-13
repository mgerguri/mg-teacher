import { Routes, Route, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from './context/AuthContext'
import { useSync } from './context/SyncContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SchedulePage from './pages/SchedulePage'
import ClassesPage from './pages/ClassesPage'
import StudentsPage from './pages/StudentsPage'
import StudentProfilePage from './pages/StudentProfilePage'
import GradesPage from './pages/GradesPage'
import AttendancePage from './pages/AttendancePage'
import ReportsPage from './pages/ReportsPage'
import WeeklyPlansPage from './pages/WeeklyPlansPage'
import SubjectsPage from './pages/SubjectsPage'
import TeachersPage from './pages/TeachersPage'
import AssessmentsPage from './pages/AssessmentsPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import GlobalSearch from './components/GlobalSearch'
import i18n, { Language, saveLanguage } from './lib/i18n'

function LanguageToggle() {
  const current = i18n.language as Language
  function toggle() {
    const next: Language = current === 'en' ? 'sq' : 'en'
    i18n.changeLanguage(next)
    saveLanguage(next)
  }
  return (
    <button
      onClick={toggle}
      className="px-2 py-1 text-xs font-medium border border-gray-200 rounded-md text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors"
      title={current === 'en' ? 'Switch to Albanian' : 'Kaloni në anglisht'}
    >
      {current === 'en' ? 'SQ' : 'EN'}
    </button>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { state: syncState } = useSync()
  const { t } = useTranslation()

  const navLink = 'flex items-center px-3 py-2 rounded-lg text-sm transition-colors w-full'
  const active   = 'bg-gray-100 text-gray-900 font-medium'
  const inactive = 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
        {/* App name */}
        <div className="px-4 py-5 border-b border-gray-100">
          <span className="font-semibold text-gray-900 text-base">{t('nav.appName')}</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
          <NavLink to="/"           end className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.dashboard')}</NavLink>
          <NavLink to="/classes"        className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.classes')}</NavLink>
          <NavLink to="/grades"         className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.grades')}</NavLink>
          <NavLink to="/attendance"     className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.attendance')}</NavLink>
          <NavLink to="/plans"          className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.plans')}</NavLink>
          <NavLink to="/reports"        className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.reports')}</NavLink>
          <NavLink to="/subjects"       className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.subjects')}</NavLink>
          <NavLink to="/assessments"    className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.assessments')}</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/teachers"     className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.teachers')}</NavLink>
          )}
          <NavLink to="/schedule"       className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.schedule')}</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/settings"     className={({ isActive }) => `${navLink} ${isActive ? active : inactive}`}>{t('nav.settings')}</NavLink>
          )}
        </nav>

        {/* Bottom: user info + controls */}
        <div className="px-3 py-4 border-t border-gray-100 flex flex-col gap-2">
          {syncState === 'syncing' && <span className="text-xs text-gray-400">{t('nav.syncing')}</span>}
          {syncState === 'error'   && <span className="text-xs text-red-500">{t('nav.syncError')}</span>}
          <div className="text-xs text-gray-600 leading-snug">
            <span className="font-medium text-gray-800">{user?.firstName} {user?.lastName}</span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{user?.role}</span>
          </div>
          <div className="flex items-center justify-between">
            <LanguageToggle />
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-900 transition-colors">
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-end">
          <GlobalSearch />
        </div>
        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/"                        element={<DashboardPage />} />
                <Route path="/classes"                 element={<ClassesPage />} />
                <Route path="/classes/:classId"        element={<StudentsPage />} />
                <Route path="/students/:studentId"     element={<StudentProfilePage />} />
                <Route path="/grades"                  element={<GradesPage />} />
                <Route path="/attendance"              element={<AttendancePage />} />
                <Route path="/plans"                   element={<WeeklyPlansPage />} />
                <Route path="/reports"                 element={<ReportsPage />} />
                <Route path="/subjects"                element={<SubjectsPage />} />
                <Route path="/assessments"             element={<AssessmentsPage />} />
                <Route path="/teachers"                element={<TeachersPage />} />
                <Route path="/schedule"                element={<SchedulePage />} />
                <Route path="/settings"                element={<SettingsPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>

  )
}
