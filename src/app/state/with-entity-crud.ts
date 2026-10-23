import { computed, inject, ProviderToken } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  withComputed,
  withMethods,
  withProps,
  withState,
  WritableStateSource,
} from '@ngrx/signals';
import {
  addEntity,
  EntityState,
  removeEntity,
  setAllEntities,
  setEntity,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { Entity } from '../core/models';
import { CrudRepository } from '../core/repositories/repositories';

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface LoadState {
  loadStatus: LoadStatus;
}

/**
 * Reusable SignalStore feature: entity collection + async CRUD through a
 * repository, with optimistic updates that roll back if persistence fails.
 */
export function withEntityCrud<E extends Entity>(repository: ProviderToken<CrudRepository<E>>) {
  return signalStoreFeature(
    withEntities<E>(),
    withState<LoadState>({ loadStatus: 'idle' }),
    withProps(() => ({ _repository: inject(repository) })),
    withComputed(({ loadStatus }) => ({
      isLoading: computed(() => loadStatus() === 'idle' || loadStatus() === 'loading'),
      hasError: computed(() => loadStatus() === 'error'),
    })),
    withMethods((store) => {
      const state = store as unknown as WritableStateSource<EntityState<E> & LoadState>;
      const repo = store._repository;

      return {
        async load(): Promise<void> {
          patchState(state, { loadStatus: 'loading' });
          try {
            const items = await repo.list();
            patchState(state, setAllEntities(items), { loadStatus: 'loaded' });
          } catch (error) {
            patchState(state, { loadStatus: 'error' });
            throw error;
          }
        },

        async add(entity: E): Promise<E> {
          patchState(state, addEntity(entity));
          try {
            const saved = await repo.create(entity);
            patchState(state, setEntity(saved));
            return saved;
          } catch (error) {
            patchState(state, removeEntity(entity.id));
            throw error;
          }
        },

        async patch(id: string, changes: Partial<E>): Promise<E> {
          const previous = store.entityMap()[id];
          patchState(state, updateEntity({ id, changes }));
          try {
            const saved = await repo.update(id, changes);
            patchState(state, setEntity(saved));
            return saved;
          } catch (error) {
            if (previous) patchState(state, setEntity(previous));
            throw error;
          }
        },

        async remove(id: string): Promise<void> {
          const previous = store.entityMap()[id];
          patchState(state, removeEntity(id));
          try {
            await repo.remove(id);
          } catch (error) {
            if (previous) patchState(state, addEntity(previous));
            throw error;
          }
        },
      };
    }),
  );
}
