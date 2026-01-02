// src/pages/Admins.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  createAdmin,
  deleteAdmin,
  getAdminById,
  getAdmins,
  updateAdmin
} from '../services/adminsService';
import '../AdminPanel/Amain.css';

const Admins = () => {
  // All available roles
  const allRoles = [
    'ادمین کل داشبورد',
    'مدیریت کاربران',
    'مدیریت نقشه',
    'مدیریت دسته بندی',
    'مدیریت اطلاعات فرهنگی',
    'مدیریت ادمین ها',
    'مدیریت گزارشات',
    'مدیریت صفحات',
    'مدیریت بازخورد ها',
    'مدیریت دیدگاه ها',
    'مدیریت لاگ های مسیریابی',
    'مدیریت کاربران ثبت نام کرده'
  ];

  // State management
  const [admins, setAdmins] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    roles: []
  });


  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);


  const [selectedRoles, setSelectedRoles] = useState([]);
  const [editAdminEmail, setEditAdminEmail] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  useEffect(() => {
    loadAdmins();
  }, [currentPage, itemsPerPage, searchTerm]);

  const loadAdmins = async (options = {}) => {
    setIsLoading(true);
    try {
      const response = await getAdmins({
        page: options.page ?? currentPage,
        pageSize: options.pageSize ?? itemsPerPage,
        search: options.search ?? searchTerm
      });
      const payload = response?.data ?? response;
      setAdmins(payload?.items || []);
      setTotalItems(payload?.meta?.totalItems ?? 0);
    } catch (error) {
      toast.error('خطا در دریافت لیست ادمین‌ها');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setNewAdmin({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      roles: []
    });
    setIsAddModalOpen(true);
  };


  const handleAddAdmin = async () => {

    if (!newAdmin.firstName.trim()
      || !newAdmin.lastName.trim()
      || !newAdmin.username.trim()
      || !newAdmin.email.trim()
      || !newAdmin.password.trim()
    ) {
      toast.error('لطفا تمام فیلدهای الزامی را پر کنید');
      return;
    }


    setIsSaving(true);

    try {
      await createAdmin({
        firstName: newAdmin.firstName.trim(),
        lastName: newAdmin.lastName.trim(),
        username: newAdmin.username.trim(),
        email: newAdmin.email.trim(),
        password: newAdmin.password,
        roles: [...newAdmin.roles]
      });
      setIsSaving(false);
      setIsAddModalOpen(false);
      toast.success('ادمین جدید با موفقیت اضافه شد');
      setCurrentPage(1);
      await loadAdmins({ page: 1 });
    } catch (error) {
      if (error?.response?.status === 409) {
        toast.error('این نام کاربری قبلاً استفاده شده است');
      } else if (error?.response?.status === 422) {
        toast.error('اطلاعات وارد شده معتبر نیست');
      } else {
        toast.error('خطا در افزودن ادمین');
      }
    } finally {
      setIsSaving(false);
    }
  };


  const handleNewAdminRoleToggle = (role) => {
    if (newAdmin.roles.includes(role)) {
      setNewAdmin({
        ...newAdmin,
        roles: newAdmin.roles.filter(r => r !== role)
      });
    } else {
      setNewAdmin({
        ...newAdmin,
        roles: [...newAdmin.roles, role]
      });
    }
  };

  const handleRefresh = async () => {
    await loadAdmins();
    toast.success('لیست ادمین‌ها به‌روزرسانی شد');

    setIsRefreshing(true);

    setTimeout(() => {


      setIsRefreshing(false);
    }, 1000);
  };

  // Format roles for display (max 3 roles + bubble)
  const formatRolesForDisplay = (roles) => {
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      return {
        displayed: [],
        extraCount: 0
      };
    }

    const displayedRoles = roles.slice(0, 3);
    const extraCount = roles.length - 3;

    return {
      displayed: displayedRoles,
      extraCount: extraCount > 0 ? extraCount : 0
    };
  };

  // Open edit modal
  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setSelectedRoles([...admin.roles]); // Clone roles array
    setEditAdminEmail(admin.email || '');
    setEditAdminPassword('');
    setIsEditModalOpen(true);
  };

  // Open details modal
  const openDetailsModal = async (admin) => {
    setIsLoading(true);
    try {
      const response = await getAdminById(admin.id);
      setSelectedAdmin(response);
      setIsDetailsModalOpen(true);
    } catch (error) {
      toast.error('خطا در دریافت جزئیات ادمین');
    } finally {
      setIsLoading(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (admin) => {
    setSelectedAdmin(admin);
    setIsDeleteModalOpen(true);
  };


  // Handle role selection toggle
  const handleRoleToggle = (role) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  // Save admin edits
  const handleSaveAdmin = async () => {
    if (!selectedAdmin || selectedRoles.length === 0) {
      toast.error('لطفا حداقل یک نقش انتخاب کنید');
      return;
    }

    if (!editAdminEmail.trim()) {
      toast.error('لطفا ایمیل را وارد کنید');
      return;
    }

    setIsSaving(true);

    // Simulate API call
    try {
      const payload = {
        roles: [...selectedRoles],
        email: editAdminEmail.trim()
      };

      if (editAdminPassword.trim()) {
        payload.password = editAdminPassword;
      }

      await updateAdmin(selectedAdmin.id, payload);
      const updatedAdmins = admins.map(admin => {
        if (admin.id === selectedAdmin.id) {
          return {
            ...admin,
            roles: [...selectedRoles],
            email: editAdminEmail.trim()
          };
        }
        return admin;
      });
      setAdmins(updatedAdmins);
      setSelectedAdmin({
        ...selectedAdmin,
        roles: [...selectedRoles],
        email: editAdminEmail.trim()
      });
      setIsSaving(false);
      setIsEditModalOpen(false);
      setEditAdminPassword('');
      toast.success('اطلاعات ادمین با موفقیت به‌روزرسانی شد');
    } catch (error) {
      toast.error('خطا در به‌روزرسانی نقش‌های ادمین');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete admin
  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;

    setIsSaving(true);

    try {
      const response = await deleteAdmin(selectedAdmin.id);
      if (response?.success) {
        const updatedAdmins = admins.filter(admin => admin.id !== selectedAdmin.id);
        setAdmins(updatedAdmins);
        if (updatedAdmins.length === 0 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        } else {
          await loadAdmins();
        }
      }
      setIsSaving(false);
      setIsDeleteModalOpen(false);
      setSelectedAdmin(null);
      toast.success('ادمین با موفقیت حذف شد');
    } catch (error) {
      toast.error('خطا در حذف ادمین');
    } finally {
      setIsSaving(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Calculate pagination
  const currentAdmins = admins;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>ادمین های حال حاضر در سیستم</h3>
              <button
                className="refresh-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <div className="loading-spinner" style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #1E2023',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            <p></p>
          </div>
          <div className="left-container">
            <div className="search-box-with-icon">
              <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
              </svg>
              <input
                type="text"
                placeholder="جستجوی نام، نام خانوادگی و..."
                value={searchTerm}
                onChange={(e) => {
                  setCurrentPage(1);
                  setSearchTerm(e.target.value);
                }}
                className="search-input7"
                id="admin-search-input"
              />
            </div>
            <button className="add-admin-btn" onClick={openAddModal}>
              افزودن ادمین
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8452 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="users-table-container" id="admins-table-container">
        <table className="users-table" id="admins-table">
          <thead>
            <tr>
              <th>نام خانوادگی</th>
              <th>نام کاربری</th>
              <th>ایمیل</th>
              <th>نقش های داده شده</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : currentAdmins.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  ادمینی یافت نشد
                </td>
              </tr>
            ) : (
              currentAdmins.map(admin => {
                const { displayed, extraCount } = formatRolesForDisplay(admin.roles);

                return (
                  <tr key={admin.id}>
                    <td>
                      <div className="user-profile-cell">
                        <div className="profile-image-small2">
                          <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                            <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                            <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                            <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                          </svg>
                        </div>
                        <strong>{admin.firstName} {admin.lastName}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="username-cell">{admin.username}</span>
                    </td>
                    <td>
                      <span className="username-cell">{admin.email || '-'}</span>
                    </td>
                    <td>
                      <div className="roles-cell">
                        <div className="displayed-roles">
                          {displayed.length === 0 ? (
                            <span className="no-role-badge">بدون نقش</span>
                          ) : (
                            displayed.map((role, index) => (
                              <span key={index} className="role-badge">
                                {role}
                              </span>
                            ))
                          )}
                        </div>
                        {extraCount > 0 && (
                          <span className="extra-roles-bubble" title={`${extraCount} نقش دیگر`}>
                            +{extraCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="edit-btn21"
                          onClick={() => openEditModal(admin)}
                          id={`edit-btn21-${admin.id}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clipPath="url(#clip0_367_3812)">
                              <path fillRule="evenodd" clipRule="evenodd" d="M7.96142 0.833374L8.99967 0.833374C9.27582 0.833374 9.49967 1.05723 9.49967 1.33337C9.49967 1.60952 9.27582 1.83337 8.99967 1.83337H7.99967C6.41419 1.83337 5.27538 1.83444 4.40873 1.95095C3.55646 2.06554 3.04264 2.28347 2.66287 2.66324C2.2831 3.04301 2.06517 3.55682 1.95059 4.40909C1.83407 5.27574 1.83301 6.41456 1.83301 8.00004C1.83301 9.58552 1.83407 10.7243 1.95059 11.591C2.06517 12.4433 2.2831 12.9571 2.66287 13.3368C3.04264 13.7166 3.55646 13.9345 4.40873 14.0491C5.27538 14.1656 6.41419 14.1667 7.99967 14.1667C9.58516 14.1667 10.724 14.1656 11.5906 14.0491C12.4429 13.9345 12.9567 13.7166 13.3365 13.3368C13.7162 12.9571 13.9342 12.4433 14.0488 11.591C14.1653 10.7243 14.1663 9.58552 14.1663 8.00004V7.00004C14.1663 6.7239 14.3902 6.50004 14.6663 6.50004C14.9425 6.50004 15.1663 6.7239 15.1663 7.00004V8.03829C15.1664 9.57722 15.1664 10.7832 15.0398 11.7242C14.9104 12.6874 14.6401 13.4474 14.0436 14.044C13.447 14.6405 12.687 14.9107 11.7239 15.0402C10.7829 15.1667 9.57685 15.1667 8.03792 15.1667H7.96143C6.4225 15.1667 5.21647 15.1667 4.27548 15.0402C3.31232 14.9107 2.55231 14.6405 1.95577 14.044C1.35923 13.4474 1.089 12.6874 0.959506 11.7242C0.832993 10.7832 0.832999 9.57722 0.833008 8.03829V7.96179C0.832999 6.42286 0.832993 5.21684 0.959506 4.27584C1.089 3.31269 1.35923 2.55267 1.95577 1.95613C2.55231 1.35959 3.31232 1.08936 4.27548 0.959872C5.21647 0.833359 6.42249 0.833366 7.96142 0.833374ZM11.18 1.51732C12.092 0.605393 13.5705 0.605393 14.4824 1.51732C15.3943 2.42924 15.3943 3.90776 14.4824 4.81969L10.0503 9.25176C9.80281 9.49931 9.64776 9.65438 9.47473 9.78934C9.27093 9.9483 9.05042 10.0846 8.81711 10.1958C8.61902 10.2902 8.41097 10.3595 8.07887 10.4702L6.14251 11.1156C5.78502 11.2348 5.39088 11.1418 5.12442 10.8753C4.85795 10.6088 4.76491 10.2147 4.88408 9.8572L5.52952 7.92086C5.6402 7.58874 5.70953 7.3807 5.80394 7.18261C5.91513 6.94929 6.05141 6.72878 6.21037 6.52499C6.34533 6.35195 6.50041 6.1969 6.74797 5.94937L11.18 1.51732ZM13.7753 2.22442C13.2539 1.70302 12.4085 1.70302 11.8871 2.22442L11.6361 2.4755C11.6512 2.53941 11.6724 2.61555 11.7018 2.70048C11.7974 2.97586 11.9782 3.33852 12.3197 3.68004C12.6612 4.02156 13.0239 4.20235 13.2992 4.29789C13.3842 4.32735 13.4603 4.34853 13.5242 4.36366L13.7753 4.11258C14.2967 3.59118 14.2967 2.74582 13.7753 2.22442ZM12.7364 5.15143C12.3925 5.0035 11.9918 4.76635 11.6126 4.38714C11.2334 4.00794 10.9962 3.60726 10.8483 3.26328L7.47801 6.63355C7.20034 6.91122 7.09144 7.02134 6.99888 7.14001C6.88459 7.28653 6.78661 7.44508 6.70666 7.61283C6.64192 7.74868 6.59212 7.89533 6.46794 8.26787L6.18001 9.13166L6.86805 9.8197L7.73184 9.53177C8.10439 9.40759 8.25104 9.35779 8.38689 9.29305C8.55464 9.21311 8.71318 9.11512 8.85971 9.00083C8.97837 8.90828 9.08849 8.79938 9.36617 8.5217L12.7364 5.15143Z" fill="#1E2023" />
                            </g>
                            <defs>
                              <clipPath id="clip0_367_3812">
                                <rect width="16" height="16" fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </button>
                        <button
                          className="delete-btn21"
                          onClick={() => openDeleteModal(admin)}
                          id={`delete-btn21-${admin.id}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M3.41092 5.1678C3.68645 5.14943 3.9247 5.3579 3.94307 5.63343L4.24969 10.2328C4.3096 11.1314 4.35228 11.7566 4.446 12.227C4.5369 12.6833 4.66379 12.9249 4.84606 13.0954C5.02834 13.2659 5.27777 13.3765 5.73911 13.4368C6.21471 13.499 6.84138 13.5 7.74194 13.5H8.25752C9.15808 13.5 9.78475 13.499 10.2604 13.4368C10.7217 13.3765 10.9711 13.2659 11.1534 13.0954C11.3357 12.9249 11.4626 12.6833 11.5535 12.227C11.6472 11.7566 11.6899 11.1314 11.7498 10.2328L12.0564 5.63343C12.0748 5.3579 12.313 5.14943 12.5885 5.1678C12.8641 5.18617 13.0725 5.42442 13.0542 5.69995L12.7452 10.3345C12.6882 11.1896 12.6422 11.8804 12.5342 12.4224C12.4219 12.986 12.231 13.4567 11.8366 13.8256C11.4422 14.1946 10.9598 14.3538 10.3901 14.4284C9.84203 14.5001 9.14973 14.5 8.29268 14.5H7.70679C6.84973 14.5 6.15743 14.5001 5.60941 14.4284C5.03964 14.3538 4.55727 14.1946 4.16288 13.8256C3.76848 13.4567 3.57753 12.986 3.46527 12.4224C3.35729 11.8804 3.31125 11.1896 3.25425 10.3344L2.94528 5.69995C2.92691 5.42442 3.13538 5.18617 3.41092 5.1678Z" fill="#1E2023" />
                            <path fillRule="evenodd" clipRule="evenodd" d="M6.90324 1.50003L6.87258 1.50001C6.72832 1.49992 6.60264 1.49984 6.48396 1.51879C6.01509 1.59366 5.60936 1.8861 5.39006 2.30723C5.33456 2.41382 5.29489 2.53309 5.24935 2.66998L5.23967 2.69905L5.17495 2.89323C5.16229 2.93121 5.15876 2.94168 5.15569 2.95016C5.03894 3.2729 4.73626 3.49106 4.39316 3.49976C4.38414 3.49999 4.37309 3.50003 4.33306 3.50003H2.33301C2.05687 3.50003 1.83301 3.72388 1.83301 4.00003C1.83301 4.27617 2.05687 4.50003 2.33301 4.50003L4.33877 4.50003L4.34993 4.50003H11.6495L11.6607 4.50003L13.6664 4.50003C13.9425 4.50003 14.1664 4.27617 14.1664 4.00003C14.1664 3.72388 13.9425 3.50003 13.6664 3.50003H11.6664C11.6264 3.50003 11.6153 3.49999 11.6063 3.49976C11.2632 3.49106 10.9605 3.27289 10.8438 2.95014C10.8407 2.94172 10.8371 2.93102 10.8245 2.89323L10.7598 2.69905L10.7501 2.66996C10.7046 2.53307 10.6649 2.41382 10.6094 2.30723C10.3901 1.8861 9.98437 1.59366 9.5155 1.51879C9.39682 1.49984 9.27114 1.49992 9.12688 1.50001L9.09622 1.50003H6.90324ZM6.09606 3.29032C6.06988 3.36269 6.03945 3.43268 6.00511 3.50003H9.99435C9.96001 3.43268 9.92959 3.3627 9.90341 3.29033L9.8776 3.21477L9.8111 3.01528C9.75032 2.83294 9.73633 2.79575 9.72245 2.76909C9.64935 2.62872 9.5141 2.53124 9.35781 2.50628C9.32813 2.50154 9.28843 2.50003 9.09622 2.50003H6.90324C6.71103 2.50003 6.67133 2.50154 6.64165 2.50628C6.48536 2.53124 6.35011 2.62872 6.27701 2.76909C6.26313 2.79575 6.24914 2.83294 6.18836 3.01528L6.12182 3.21489C6.1118 3.24495 6.10401 3.26834 6.09606 3.29032Z" fill="#1E2023" />
                          </svg>
                        </button>
                        <button
                          className="details-btn"
                          onClick={() => openDetailsModal(admin)}
                          id={`details-btn-${admin.id}`}
                        >
                          جزئیات بیشتر
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!isLoading  && (
          <div className="pagination-container" id="admins-pagination">
            <div className="pagination-controls">
              <div className="btc">
                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>
              </div>

              <div className="page-numbers">
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    className={`page-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <div className="btc">
                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Admin Modal */}
      {isEditModalOpen && selectedAdmin && (
        <div className="modal-overlay" id="edit-admin-modal">
          <div className="edit-admin-modal">
            <div className="modal-header-edit-admin">
              <h3>ویرایش نقش‌های ادمین</h3>
              <button
                className="close-btn"
                onClick={() => setIsEditModalOpen(false)}
                id="close-edit-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-edit-admin">
              <div className="admin-basic-info">
                <div className="info-field">
                  <label>نام و نام خانوادگی</label>
                  <div className="readonly-field">
                    {selectedAdmin.firstName} {selectedAdmin.lastName}
                  </div>
                </div>
                <div className="info-field">
                  <label>نام کاربری</label>
                  <div className="readonly-field">
                    {selectedAdmin.username}
                  </div>
                </div>
                <div className="info-field">
                  <label>ایمیل</label>
                  <input
                    type="email"
                    className="form-input-add-admin"
                    value={editAdminEmail}
                    onChange={(event) => setEditAdminEmail(event.target.value)}
                    id="edit-admin-email"
                  />
                </div>
                <div className="info-field">
                  <label>رمز عبور جدید</label>
                  <input
                    type="password"
                    className="form-input-add-admin"
                    value={editAdminPassword}
                    onChange={(event) => setEditAdminPassword(event.target.value)}
                    id="edit-admin-password"
                    placeholder="در صورت نیاز تغییر دهید"
                  />
                </div>
              </div>

              <div className="roles-section">
                <h4 className="form-label-rejection-reason">انتخاب نقش‌ها</h4>
                <div className="roles-checkboxes">
                  {allRoles.map((role, index) => (
                    <label key={index} className="role-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => handleRoleToggle(role)}
                        id={`role-${index}`}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer-edit-admin">
              <button
                className="action-btn save-btn"
                onClick={handleSaveAdmin}
                disabled={isSaving || selectedRoles.length === 0}
                id="save-admin-btn"
              >
                {isSaving ? 'در حال ذخیره...' : 'تایید و افزودن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Details Modal */}
      {isDetailsModalOpen && selectedAdmin && (
        <div className="modal-overlay" id="admin-details-modal">
          <div className="admin-details-modal">
            <div className="modal-header-admin-details">
              <h3>جزئیات ادمین</h3>
              <button
                className="close-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                id="close-details-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-admin-details">
              <div className="admin-info-section">
                <div className="info-row">
                  <span className="info-label">نام و نام خانوادگی:</span>
                  <span className="info-value">{selectedAdmin.firstName} {selectedAdmin.lastName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">نام کاربری:</span>
                  <span className="info-value">{selectedAdmin.username}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">تاریخ ایجاد:</span>
                  <span className="info-value">{selectedAdmin.createdAt}</span>
                </div>
                {/* <div className="info-row">
                  <span className="info-label">وضعیت:</span>
                  <span className={`status-badge ${selectedAdmin.status}`}>
                    {selectedAdmin.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </span>
                </div> */}
              </div>

              <div className="admin-roles-section">
                <h4>نقش‌های داده شده</h4>
                <div className="roles-list">
                  {selectedAdmin.roles.map((role, index) => (
                    <div key={index} className="role-item">
                      {role}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer-admin-details">
              <button
                className="action-btn close-details-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                id="close-details-btn"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedAdmin && (
        <div className="modal-overlay" id="delete-admin-modal">
          <div className="delete-admin-modal">
            <div className="modal-header-delete-admin">
              <button
                className="close-btn"
                onClick={() => setIsDeleteModalOpen(false)}
                id="close-delete-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-delete-admin">
              <div className="warning-icon">
                ⚠️
              </div>
              <h4>آیا از حذف این ادمین مطمئن هستید؟</h4>
              <div className="admin-to-delete">
                <strong>{selectedAdmin.firstName} {selectedAdmin.lastName}</strong>
                <span>({selectedAdmin.username})</span>
              </div>
              <div className="delete-warning">
                این عمل قابل بازگشت نیست و تمام دسترسی‌های این ادمین حذف خواهد شد.
              </div>
            </div>
            <div className="modal-footer-delete-admin">
              <button
                className="action-btn cancel-delete-btn"
                onClick={() => setIsDeleteModalOpen(false)}
                id="cancel-delete-btn"
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="action-btn confirm-delete-btn"
                onClick={handleDeleteAdmin}
                disabled={isSaving}
                id="confirm-delete-btn"
              >
                {isSaving ? 'در حال حذف...' : 'حذف ادمین'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddModalOpen && (
        <div className="modal-overlay" id="add-admin-modal-unique">
          <div className="add-admin-modal">
            <div className="modal-header-add-admin">
              <h3>افزودن ادمین جدید</h3>
              <button
                className="close-btn"
                onClick={() => setIsAddModalOpen(false)}
                id="close-add-modal"
              >
                ×
              </button>
            </div>
            <div className="modal-body-add-admin">
              <div className="admin-basic-info">
                <div className="info-field">
                  <label>نام <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input-add-admin"
                    value={newAdmin.firstName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })}
                    placeholder="نام را وارد کنید"
                    id="add-admin-firstname"
                  />
                </div>
                <div className="info-field">
                  <label>نام خانوادگی <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input-add-admin"
                    value={newAdmin.lastName}
                    onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })}
                    placeholder="نام خانوادگی را وارد کنید"
                    id="add-admin-lastname"
                  />
                </div>
                <div className="info-field">
                  <label>نام کاربری <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input-add-admin"
                    value={newAdmin.username}
                    onChange={(e) => setNewAdmin({ ...newAdmin, username: e.target.value })}
                    placeholder="نام کاربری را وارد کنید"
                    id="add-admin-username"
                  />
                </div>
                <div className="info-field">
                  <label>ایمیل <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="email"
                    className="form-input-add-admin"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                    placeholder="ایمیل را وارد کنید"
                    id="add-admin-email"
                  />
                </div>
                <div className="info-field">
                  <label>رمز عبور <span style={{ color: 'red' }}>*</span></label>
                  <input
                    type="password"
                    className="form-input-add-admin"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    placeholder="رمز عبور را وارد کنید"
                    id="add-admin-password"
                  />
                </div>
              </div>

              <div className="roles-section-add-admin">
                <h4>انتخاب نقش‌ها </h4>
                <div className="roles-checkboxes-add-admin">
                  {allRoles.map((role, index) => (
                    <label key={index} className="role-checkbox-label-add-admin">
                      <input
                        type="checkbox"
                        checked={newAdmin.roles.includes(role)}
                        onChange={() => handleNewAdminRoleToggle(role)}
                        id={`add-role-${index}`}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer-add-admin">
              <button
                className="cancel-btn-add-admin"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSaving}
                id="cancel-add-admin-btn"
              >
                انصراف
              </button>
              <button
                className="action-btn save-btn"
                onClick={handleAddAdmin}
                disabled={isSaving
                  || !newAdmin.firstName.trim()
                  || !newAdmin.lastName.trim()
                  || !newAdmin.username.trim()
                  || !newAdmin.email.trim()
                  || !newAdmin.password.trim()
                }
                id="add-admin-submit-btn"
              >
                {isSaving ? 'در حال ذخیره...' : 'افزودن ادمین'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admins;
