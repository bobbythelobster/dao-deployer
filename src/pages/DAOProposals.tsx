import { useParams } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import { PageLoader } from "../components/LoadingSpinner";

const ProposalList = lazy(() => import("../components/ProposalList"));

export default function DAOProposals() {
  const params = useParams();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <ProposalList daoId={params.id} />
    </Suspense>
  );
}
