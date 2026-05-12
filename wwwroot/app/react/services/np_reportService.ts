import api from './np_api';

export interface ReportData {
  jobsCompleted: number;
  onTimePercent: number;
  revenue: string;
  dailyVolume: { day: string; value: number }[];
}

const EMPTY: ReportData = {
  jobsCompleted: 0,
  onTimePercent: 0,
  revenue: '$0',
  dailyVolume: [],
};

export const reportService = {
  async getData(from: string, to: string): Promise<ReportData> {
    const { data } = await api.get<ReportData>('/reports', { params: { from, to } });
    return data ?? EMPTY;
  },
};
