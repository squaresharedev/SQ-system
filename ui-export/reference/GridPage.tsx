import { GridCanvas } from "@/components/GridCanvas";

interface GridPageProps {
  modalOpen: boolean;
  onCloseModal: () => void;
  activeCollectionId?: string | null;
  collectionName?: string | null;
  collectionIsPublic?: boolean;
  onAddArtifact?: () => void;
}

export function GridPage({ modalOpen, onCloseModal, activeCollectionId, collectionName, collectionIsPublic, onAddArtifact }: GridPageProps) {
  return (
    <div className="mx-auto max-w-[1440px]">
      <GridCanvas
        modalOpen={modalOpen}
        onCloseModal={onCloseModal}
        activeCollectionId={activeCollectionId}
        collectionName={collectionName}
        collectionIsPublic={collectionIsPublic}
        onAddArtifact={onAddArtifact}
      />
    </div>
  );
}
