import { useParams, useNavigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import { PageLoader } from "../components/LoadingSpinner";

const CreateProposal = lazy(() => import("../components/CreateProposal"));

export default function DAOCreateProposal() {
  const params = useParams();
  const navigate = useNavigate();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateProposal 
        daoId={params.id}
        onSuccess={() => navigate(`/dao/${params.id}/proposals`)}
        onCancel={() => navigate(`/dao/${params.id}/proposals`)}
      />
    </Suspense>
  );
}
