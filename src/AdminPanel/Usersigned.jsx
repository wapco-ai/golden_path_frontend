import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import {
  fetchSignedUser,
  fetchSignedUsers,
  updateSignedUserStatus
} from '../api/adminUsers.api';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const getStatusValue = (user) => {
  if (user?.status) return user.status;
  if (typeof user?.isActive === 'boolean') return user.isActive ? 'active' : 'inactive';
  return 'inactive';
};

const getErrorMessage = (error) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 422) {
    return message || 'اطلاعات ارسال شده معتبر نیست.';
  }

  if (status >= 500) {
    return 'مشکلی در سرور رخ داده است. لطفاً دوباره تلاش کنید.';
  }

  return message || 'دریافت اطلاعات با خطا مواجه شد.';
};

function Usersigned() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, per_page: 20, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailUserId, setDetailUserId] = useState(null);
  const [updatingMap, setUpdatingMap] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchSignedUsers({
        page,
        pageSize,
        search: debouncedSearch
      });

      setRows(response?.data || []);
      const nextMeta = response?.meta || { current_page: page, per_page: pageSize, last_page: 1, total: 0 };
      setMeta(nextMeta);
      if (nextMeta?.current_page && nextMeta.current_page !== page) {
        setPage(nextMeta.current_page);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > (meta?.last_page || 1)) return;
    setPage(nextPage);
  };

  const handleDetailsClick = async (userId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setSelectedUser(null);
    setDetailUserId(userId);

    try {
      const response = await fetchSignedUser(userId);
      setSelectedUser(response?.data || response);
    } catch (err) {
      const message = getErrorMessage(err);
      setDetailError(message);
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailOpen(false);
    setSelectedUser(null);
    setDetailError('');
    setDetailUserId(null);
  };

  const handleToggleStatus = async (user) => {
    const currentStatus = getStatusValue(user);
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    setUpdatingMap((prev) => ({ ...prev, [user.id]: true }));
    setRows((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? { ...item, status: nextStatus, isActive: nextStatus === 'active' }
          : item
      )
    );

    try {
      await updateSignedUserStatus(user.id, nextStatus);
      toast.success('وضعیت کاربر به روز شد.');
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
      setRows((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, status: currentStatus, isActive: currentStatus === 'active' }
            : item
        )
      );
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  };

  const totalPages = meta?.last_page || 1;
  const pageNumbers = useMemo(() => {
    const maxVisible = 6;
    const current = page;
    const total = totalPages;
    const pages = [];

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i += 1) pages.push(i);
      return pages;
    }

    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const handleToggleStatus = async (user) => {
    const currentStatus = getStatusValue(user);
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    setUpdatingMap((prev) => ({ ...prev, [user.id]: true }));
    setFilteredUsers((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? { ...item, status: nextStatus, isActive: nextStatus === 'active' }
          : item
      )
    );

    try {
      await updateSignedUserStatus(user.id, nextStatus);
      toast.success('وضعیت کاربر به روز شد.');
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
      setFilteredUsers((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, status: currentStatus, isActive: currentStatus === 'active' }
            : item
        )
      );
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  };

  return (
    <div className="usersigned-page">
      <div className="users-section">
        <div className="section-header">
          <div className="section-header-top">
            <div className="title-container">
              <div className="title-cell">
                <h3>لیست کاربران ثبت نام شده</h3>
              </div>
              <p>مجموع کاربران: {meta?.total ?? 0}</p>
            </div>
            <div className="left-container">
              <div className="search-box-with-icon">
                <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                </svg>
                <input
                  type="text"
                  placeholder="جستجو بر اساس نام، ایمیل یا موبایل"
                  value={search}
                  onChange={handleSearchChange}
                  className="search-input7"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-state" style={{ marginBottom: '16px' }}>
            <p>{error}</p>
            <button className="details-btn" onClick={fetchUsers}>تلاش دوباره</button>
          </div>
        )}

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>موبایل</th>
                <th>ایمیل</th>
                <th>وضعیت</th>
                <th>تاریخ ثبت نام</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6">
                    <div className="loading-state" style={{ padding: '16px', textAlign: 'center' }}>
                      در حال دریافت اطلاعات...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state" style={{ padding: '16px', textAlign: 'center' }}>
                      داده ای برای نمایش وجود ندارد.
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.map((user) => {
                const statusValue = getStatusValue(user);
                const statusLabel = statusValue === 'active' ? 'فعال' : 'غیرفعال';

                return (
                  <tr key={user.id}>
                    <td>{user.name || '—'}</td>
                    <td>{user.mobile || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <span className={`status-badge ${statusValue === 'active' ? 'active' : 'inactive'}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>{formatDateTime(user.createdAt)}</td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <button className="details-btn" onClick={() => handleDetailsClick(user.id)}>
                          جزئیات
                        </button>
                        <button
                          className="details-btn"
                          disabled={!!updatingMap[user.id]}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {statusValue === 'active' ? 'غیرفعال' : 'فعال'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="pagination-container">
            <div className="pagination-controls">
              <div className="btc">
                <button
                  className={`pagination-btn ${page === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  قبلی
                </button>
              </div>

              <div className="page-numbers">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={`page-number ${page === pageNumber ? 'active' : ''}`}
                    onClick={() => handlePageChange(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <div className="btc">
                <button
                  className={`pagination-btn ${page === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  بعدی
                </button>
              </div>
            </div>
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              صفحه {page} از {totalPages}
            </div>
          </div>
        </div>
      </div>

      {detailOpen && (
        <div className="user-details-modal-overlay" onClick={handleCloseDetails}>
          <div
            className="user-details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <h3>جزئیات کاربر</h3>
            </div>

            <div className="modal-content">
              {detailLoading && (
                <div style={{ padding: '16px', textAlign: 'center' }}>در حال دریافت اطلاعات...</div>
              )}

              {!detailLoading && detailError && (
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <p>{detailError}</p>
                  <button
                    className="details-btn"
                    onClick={() => detailUserId && handleDetailsClick(detailUserId)}
                  >
                    تلاش دوباره
                  </button>
                </div>
              )}

              {!detailLoading && !detailError && selectedUser && (
                <div className="user-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">نام:</span>
                    <span className="detail-value">{selectedUser.name || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">نام کاربری:</span>
                    <span className="detail-value">{selectedUser.username || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ایمیل:</span>
                    <span className="detail-value">{selectedUser.email || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">موبایل:</span>
                    <span className="detail-value">{selectedUser.mobile || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">وضعیت:</span>
                    <span className="detail-value">{getStatusValue(selectedUser) === 'active' ? 'فعال' : 'غیرفعال'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">تاریخ ثبت نام:</span>
                    <span className="detail-value">{formatDateTime(selectedUser.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">آخرین ورود:</span>
                    <span className="detail-value">{formatDateTime(selectedUser.lastLoginAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">IP آخرین ورود:</span>
                    <span className="detail-value">{selectedUser.lastLoginIp || '—'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-close-button-usersigned"
                onClick={handleCloseDetails}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usersigned;
