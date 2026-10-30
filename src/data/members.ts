/**
 * EDIT THIS FILE TO UPDATE THE PROJECT TEAM.
 * 1. Put each photo in  public/images/members/  (e.g. member-1.jpg).
 * 2. Edit name, role, post, bio and image below. The Team page renders from this array.
 * If an image file is missing, a neutral placeholder is shown automatically.
 */
export interface ProjectMember {
  id: number
  name: string
  role: string
  bio: string
  /** Path under /public, e.g. "/images/members/member-1.jpg" */
  image: string
  post: string
}

export const projectMembers: ProjectMember[] = [
  { id: 1, name: 'Member Name', role: 'Project Lead', bio: 'Responsible for project coordination and methodology.', image: '/images/members/member-1.jpg', post: 'B.Tech Civil Engineering' },
  { id: 2, name: 'Member Name', role: 'Data Analyst', bio: 'Responsible for rainfall and sedimentation datasets.', image: '/images/members/member-2.jpg', post: 'Data Analysis' },
  { id: 3, name: 'Member Name', role: 'Modelling Engineer', bio: 'Responsible for reservoir storage calculations.', image: '/images/members/member-3.jpg', post: 'Hydrological Modelling' },
  { id: 4, name: 'Member Name', role: 'UI/UX Designer', bio: 'Responsible for dashboard design and visualization.', image: '/images/members/member-4.jpg', post: 'Frontend Development' },
]
