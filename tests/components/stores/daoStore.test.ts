/**
 * DAO Store Tests
 * Tests for the DAO state management store
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createDAOStore } from '../../../src/stores/daoStore';
import { MOCK_DAO_INFO } from '../../mocks/data';

describe('DAO Store', () => {
  let store: ReturnType<typeof createDAOStore>;

  beforeEach(() => {
    store = createDAOStore();
  });

  it('should initialize with empty state', () => {
    expect(store.state.daos).toEqual([]);
    expect(store.state.selectedDAO).toBeNull();
    expect(store.state.loading).toBe(false);
    expect(store.state.error).toBeNull();
  });

  it('should set DAO list', () => {
    const daos = [MOCK_DAO_INFO, { ...MOCK_DAO_INFO, address: '0xother', name: 'Other DAO' }];
    
    store.setDAOs(daos);
    
    expect(store.state.daos).toHaveLength(2);
    expect(store.state.daos[0].name).toBe('Test DAO');
    expect(store.state.daos[1].name).toBe('Other DAO');
  });

  it('should select DAO', () => {
    store.selectDAO(MOCK_DAO_INFO);
    
    expect(store.state.selectedDAO).toBeDefined();
    expect(store.state.selectedDAO?.address).toBe(MOCK_DAO_INFO.address);
  });

  it('should clear selected DAO', () => {
    store.selectDAO(MOCK_DAO_INFO);
    expect(store.state.selectedDAO).toBeDefined();
    
    store.clearSelectedDAO();
    expect(store.state.selectedDAO).toBeNull();
  });

  it('should set loading state', () => {
    store.setLoading(true);
    expect(store.state.loading).toBe(true);
    
    store.setLoading(false);
    expect(store.state.loading).toBe(false);
  });

  it('should set error state', () => {
    const error = 'Failed to load DAOs';
    
    store.setError(error);
    expect(store.state.error).toBe(error);
  });

  it('should clear error state', () => {
    store.setError('Some error');
    store.clearError();
    expect(store.state.error).toBeNull();
  });

  it('should add DAO to list', () => {
    const newDAO = { ...MOCK_DAO_INFO, address: '0xnew', name: 'New DAO' };
    
    store.addDAO(newDAO);
    
    expect(store.state.daos).toHaveLength(1);
    expect(store.state.daos[0].name).toBe('New DAO');
  });

  it('should update existing DAO', () => {
    store.addDAO(MOCK_DAO_INFO);
    
    const updatedDAO = { ...MOCK_DAO_INFO, memberCount: 200 };
    store.updateDAO(updatedDAO);
    
    expect(store.state.daos[0].memberCount).toBe(200);
  });

  it('should remove DAO from list', () => {
    store.addDAO(MOCK_DAO_INFO);
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xother' });
    
    expect(store.state.daos).toHaveLength(2);
    
    store.removeDAO(MOCK_DAO_INFO.address);
    
    expect(store.state.daos).toHaveLength(1);
    expect(store.state.daos[0].address).toBe('0xother');
  });

  it('should get DAO by address', () => {
    store.addDAO(MOCK_DAO_INFO);
    
    const found = store.getDAOByAddress(MOCK_DAO_INFO.address);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test DAO');
  });

  it('should return null for non-existent DAO', () => {
    const found = store.getDAOByAddress('0xnonexistent');
    expect(found).toBeNull();
  });

  it('should filter DAOs by search term', () => {
    store.addDAO({ ...MOCK_DAO_INFO, name: 'Alpha DAO' });
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xbeta', name: 'Beta DAO' });
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xgamma', name: 'Gamma DAO' });
    
    const filtered = store.searchDAOs('Alpha');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Alpha DAO');
  });

  it('should sort DAOs by member count', () => {
    store.addDAO({ ...MOCK_DAO_INFO, name: 'Small DAO', memberCount: 50 });
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xbig', name: 'Big DAO', memberCount: 500 });
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xmed', name: 'Medium DAO', memberCount: 200 });
    
    store.sortDAOs('memberCount', 'desc');
    
    expect(store.state.daos[0].name).toBe('Big DAO');
    expect(store.state.daos[1].name).toBe('Medium DAO');
    expect(store.state.daos[2].name).toBe('Small DAO');
  });

  it('should track created DAOs count', () => {
    expect(store.createdCount).toBe(0);
    
    store.addDAO(MOCK_DAO_INFO);
    expect(store.createdCount).toBe(1);
    
    store.addDAO({ ...MOCK_DAO_INFO, address: '0xother' });
    expect(store.createdCount).toBe(2);
  });
});
