// Registration Settings — live, backed by /api/v1/np/registration-sites.
// Toggles the legacy TblSite.CourierApplicantEnabled flag per site.
import api from './np_api';

export interface RegistrationSite {
  id: number;
  name: string;
  applicantEnabled: boolean;
}

export const registrationSiteService = {
  async getSites(): Promise<RegistrationSite[]> {
    const { data } = await api.get<RegistrationSite[]>('/registration-sites');
    return data ?? [];
  },

  async setEnabled(id: number, applicantEnabled: boolean): Promise<RegistrationSite> {
    const { data } = await api.put<RegistrationSite>(`/registration-sites/${id}`, { applicantEnabled });
    return data;
  },
};
