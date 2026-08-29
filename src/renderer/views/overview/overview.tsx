
import { Route, Routes } from 'react-router-dom';
import RunOverview from './runOverview';

function OverviewContent() {
  return (
    <>
      <div>
        <div className="">
          <div
            className="h-screen"
          >
          <RunOverview />

          </div>
        </div>
      </div>
    </>
  );
}
export default function OverviewPage() {
  return (
    <Routes>
      <Route path="*" element={<OverviewContent />} />
    </Routes>
  );
}
