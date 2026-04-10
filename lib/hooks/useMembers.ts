import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  projectApi,
  type ProjectMember,
  type MemberCreate,
  type MemberUpdate,
  type MemberListResponse,
} from "@/lib/api/projects";

export const memberQueryKeys = {
  list: (projectId: string) => ["members", projectId] as const,
};

export function useMembers(projectId: string, accessToken?: string) {
  return useQuery({
    queryKey: memberQueryKeys.list(projectId),
    queryFn: () => projectApi.listMembers(projectId, accessToken!),
    enabled: !!projectId && !!accessToken,
  });
}

export function useAddMember(projectId: string, accessToken?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MemberCreate) => projectApi.addMember(projectId, data, accessToken!),
    onSuccess: (newMember) => {
      queryClient.setQueryData<MemberListResponse>(
        memberQueryKeys.list(projectId),
        (old) =>
          old
            ? { ...old, items: [...old.items, newMember], total: old.total + 1 }
            : { items: [newMember], total: 1 },
      );
    },
  });
}

export function useUpdateMemberRole(projectId: string, accessToken?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: MemberUpdate }) =>
      projectApi.updateMember(projectId, userId, data, accessToken!),
    onSuccess: (updated) => {
      queryClient.setQueryData<MemberListResponse>(
        memberQueryKeys.list(projectId),
        (old) =>
          old
            ? {
                ...old,
                items: old.items.map((m: ProjectMember) =>
                  m.user_id === updated.user_id ? updated : m,
                ),
              }
            : undefined,
      );
    },
  });
}

export function useRemoveMember(projectId: string, accessToken?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId, accessToken!),
    onSuccess: (_, userId) => {
      queryClient.setQueryData<MemberListResponse>(
        memberQueryKeys.list(projectId),
        (old) =>
          old
            ? {
                ...old,
                items: old.items.filter((m: ProjectMember) => m.user_id !== userId),
                total: old.total - 1,
              }
            : undefined,
      );
    },
  });
}
