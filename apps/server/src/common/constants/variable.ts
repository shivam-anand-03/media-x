export const jobConfig = {
  removeOnComplete: true,
  removeOnFail: true,
  removeDependencyOnFailure: true,
};

// Separate Pinecone namespaces keep job vectors and candidate-profile vectors
// from polluting each other's similarity searches.
export const VECTOR_NAMESPACE = {
  JOB: "task-embedding",
  PROFILE: "profile-embedding",
} as const;
