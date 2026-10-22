import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole, type Role } from './lib/auth';
import { Loading } from './components/ui';
import Login from './pages/Login';

const StudentHome = lazy(() => import('./pages/student/Home'));
const StudentTree = lazy(() => import('./pages/student/Tree'));
const StudentSession = lazy(() => import('./pages/student/Session'));
const StudentQuiz = lazy(() => import('./pages/student/Quiz'));
const StudentPortfolio = lazy(() => import('./pages/student/Portfolio'));
const StudentSpecialization = lazy(() => import('./pages/student/Specialization'));
const PublicPortfolio = lazy(() => import('./pages/student/PublicPortfolio'));

const TeacherDashboard = lazy(() => import('./pages/teacher/Dashboard'));
const TeacherPlanner = lazy(() => import('./pages/teacher/Planner'));
const TeacherGradebook = lazy(() => import('./pages/teacher/Gradebook'));

const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminReport = lazy(() => import('./pages/admin/Report'));
const AdminSchedule = lazy(() => import('./pages/admin/Schedule'));
const AdminStudents = lazy(() => import('./pages/admin/Students'));
const AdminTeachers = lazy(() => import('./pages/admin/Teachers'));
const AdminSelection = lazy(() => import('./pages/admin/Selection'));
const AdminAssessments = lazy(() => import('./pages/admin/Assessments'));
const AdminStructure = lazy(() => import('./pages/admin/Structure'));
const CandidateAssessment = lazy(() => import('./pages/candidate/Assessment'));

const as = (role: Role, el: ReactNode) => <RequireRole role={role}>{el}</RequireRole>;

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/student" element={as('student', <StudentHome lang="en" />)} />
        <Route path="/student/ar" element={as('student', <StudentHome lang="ar" />)} />
        <Route path="/student/tree" element={as('student', <StudentTree />)} />
        <Route path="/student/session" element={as('student', <StudentSession />)} />
        <Route path="/student/session/:lessonId" element={as('student', <StudentSession />)} />
        <Route path="/student/quiz" element={as('student', <StudentQuiz />)} />
        <Route path="/student/quiz/:quizId" element={as('student', <StudentQuiz />)} />
        <Route path="/student/portfolio" element={as('student', <StudentPortfolio />)} />
        <Route path="/student/specialization" element={as('student', <StudentSpecialization />)} />
        <Route path="/p/:token" element={<PublicPortfolio />} />

        <Route path="/teacher" element={as('teacher', <TeacherDashboard />)} />
        <Route path="/teacher/planner" element={as('teacher', <TeacherPlanner />)} />
        <Route path="/teacher/gradebook" element={as('teacher', <TeacherGradebook />)} />

        <Route path="/admin" element={as('admin', <AdminOverview />)} />
        <Route path="/admin/report" element={as('admin', <AdminReport />)} />
        <Route path="/admin/schedule" element={as('admin', <AdminSchedule />)} />
        <Route path="/admin/students" element={as('admin', <AdminStudents />)} />
        <Route path="/admin/teachers" element={as('admin', <AdminTeachers />)} />
        <Route path="/admin/selection" element={as('admin', <AdminSelection />)} />
        <Route path="/admin/assessments" element={as('admin', <AdminAssessments />)} />
        <Route path="/admin/structure" element={as('admin', <AdminStructure />)} />
        <Route path="/admin/try-assessment" element={as('admin', <CandidateAssessment preview />)} />
        <Route path="/assess/:token" element={<CandidateAssessment />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
