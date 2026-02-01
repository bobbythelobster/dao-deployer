import { useParams } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import { PageLoader } from "../components/LoadingSpinner";

const ProposalDetail = lazy(() => import("../components/ProposalDetail"));

export default function DAOProposalDetail() {
  const params = useParams();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <ProposalDetail 
        daoId={params.id}
        proposalId={params.proposalId}
      />
    </Suspense>
  );
}
