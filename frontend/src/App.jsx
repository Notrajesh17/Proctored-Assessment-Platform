import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth-context'
import Login from './pages/Login'
import AdminHome from './pages/AdminHome'
import AssessmentEditor from './pages/AssessmentEditor'
import Submissions from './pages/Submissions'
import SubmissionDetail from './pages/SubmissionDetail'
import CandidateHome from './pages/CandidateHome'
import Exam from './pages/Exam'
import ExamResult from './pages/ExamResult'

function Guard({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/candidate'} replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <Guard role="admin">
            <AdminHome />
          </Guard>
        }
      />
      <Route
        path="/admin/papers/:id"
        element={
          <Guard role="admin">
            <AssessmentEditor />
          </Guard>
        }
      />
      <Route
        path="/admin/papers/:id/submissions"
        element={
          <Guard role="admin">
            <Submissions />
          </Guard>
        }
      />
      <Route
        path="/admin/attempts/:id"
        element={
          <Guard role="admin">
            <SubmissionDetail />
          </Guard>
        }
      />
      <Route
        path="/candidate"
        element={
          <Guard role="candidate">
            <CandidateHome />
          </Guard>
        }
      />
      <Route
        path="/exam/:assignmentId"
        element={
          <Guard role="candidate">
            <Exam />
          </Guard>
        }
      />
      <Route
        path="/result/:id"
        element={
          <Guard role="candidate">
            <ExamResult />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
