// src/pages/Marks.jsx
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../AdminPanel/Amain.css';
import apiAdmin from '../api/apiAdmin';
import { deleteFile } from '../services/fileService';

// RTL plugin initialization
function ensureRtlOnce() {
  if (window.__RTL_PLUGIN_SET__) return;
  window.__RTL_PLUGIN_SET__ = true;
  maplibregl.setRTLTextPlugin("/rtl/mapbox-gl-rtl-text.js", null, true);
}

// Custom red marker creator
const createRedMarker = () => {
  const el = document.createElement('div');
  el.innerHTML = `
    <svg width="24" height="41" viewBox="0 0 24 41" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37258 0 0 6.00388 0 12.75C0 19.4433 3.82999 26.7186 9.8056 29.5117C11.1986 30.1628 12.8014 30.1628 14.1944 29.5117C20.17 26.7186 24 19.4433 24 12.75C24 6.00388 18.6274 0 12 0ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#EA4335"/>
      <path d="M12.0088 22.5685C7.15256 22.5687 3.21582 26.5061 3.21582 31.3624C3.21606 36.2185 7.15271 40.1552 12.0088 40.1554C16.8651 40.1554 20.8025 36.2187 20.8027 31.3624C20.8027 26.506 16.8652 22.5685 12.0088 22.5685Z" stroke="#EA4335" stroke-width="1.50419"/>
    </svg>
  `;
  el.style.cursor = 'pointer';
  el.style.width = '24px';
  el.style.height = '41px';
  el.style.transform = 'translate(-50%, -100%)';
  return el;
};

const ORIENTATION_TO_AZIMUTH = {
  north: 0,
  north_east: 45,
  east: 90,
  south_east: 135,
  south: 180,
  south_west: 225,
  west: 270,
  north_west: 315,
  unknown: null
};

const ORIENTATION_LABELS_FA = {
  north: 'شمال',
  north_east: 'شمال‌شرق',
  east: 'شرق',
  south_east: 'جنوب‌شرق',
  south: 'جنوب',
  south_west: 'جنوب‌غرب',
  west: 'غرب',
  north_west: 'شمال‌غرب',
  unknown: 'نامشخص'
};

const ORIENTATION_OPTIONS = Object.keys(ORIENTATION_LABELS_FA);

const getImageOrientation = (image) => {
  if (!image || typeof image !== 'object') return 'unknown';
  return image.view_orientation || image.orientation || image.direction || image.dir || image.heading || 'unknown';
};

const getDirectionLabel = (orientation) => ORIENTATION_LABELS_FA[orientation] || ORIENTATION_LABELS_FA.unknown;

const normalizeGuidanceImage = (image = {}, index = 0) => {
  const orientation = getImageOrientation(image);
  const azimuthRaw = image.azimuth_deg;
  const azimuth = azimuthRaw === '' || azimuthRaw === undefined || azimuthRaw === null
    ? ORIENTATION_TO_AZIMUTH[orientation]
    : Number(azimuthRaw);

  return {
    ...image,
    id: image.id || `existing-${index}-${image.image_key || image.path || image.image_url || image.url || Date.now()}`,
    file: image.file,
    path: image.image_key || image.path || extractStoragePath(image.image_url) || extractStoragePath(image.url) || null,
    image_key: image.image_key || image.path || extractStoragePath(image.image_url) || extractStoragePath(image.url) || null,
    image_url: image.image_url || image.url || image.previewUrl || '',
    url: image.url || image.image_url || image.previewUrl || '',
    previewUrl: image.previewUrl || image.url || image.image_url || '',
    sort_order: Number.isFinite(Number(image.sort_order)) ? Number(image.sort_order) : index,
    view_orientation: orientation,
    azimuth_deg: Number.isFinite(azimuth) ? azimuth : null,
    fov_deg: Number.isFinite(Number(image.fov_deg)) ? Number(image.fov_deg) : 60,
    caption: image.caption || ''
  };
};

const appendGuidanceImagesToFormData = (fd, images) => {
  const newImages = images.filter((img) => img.file instanceof File);
  newImages.forEach((img, index) => {
    const orientation = img.view_orientation || 'unknown';
    const azimuth = img.azimuth_deg !== undefined && img.azimuth_deg !== null
      ? img.azimuth_deg
      : ORIENTATION_TO_AZIMUTH[orientation];

    fd.append('images[]', img.file);
    fd.append(`image_orientations[${index}]`, orientation);
    fd.append(`image_azimuths[${index}]`, azimuth === null || azimuth === undefined || azimuth === '' ? '' : String(azimuth));
    fd.append(`image_fovs[${index}]`, String(img.fov_deg || 60));
    fd.append(`image_captions[${index}]`, img.caption || '');
  });
};

const extractStoragePath = (urlOrPath) => {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;

  if (urlOrPath.startsWith('uploads/')) {
    return urlOrPath;
  }

  const marker = '/storage/';
  const index = urlOrPath.indexOf(marker);

  if (index >= 0) {
    return urlOrPath.slice(index + marker.length);
  }

  return null;
};

const resolvePersistedImagePath = (image) => {
  if (!image || image.file) return null;

  return (
    image.image_key ||
    image.path ||
    extractStoragePath(image.image_url) ||
    extractStoragePath(image.url) ||
    null
  );
};

const Marks = () => {
  const [marks, setMarks] = useState([]);

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMark, setSelectedMark] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [deletedImages, setDeletedImages] = useState([]);

  // Orientation modal states
  const [showOrientationModal, setShowOrientationModal] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [selectedOrientation, setSelectedOrientation] = useState('unknown');
  const [pendingImageCallback, setPendingImageCallback] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    images: [],
    location: null,
    floor: 0
  });

  // Map refs
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Filter marks based on search
  const filteredMarks = marks;

  // Pagination
  const totalPages = Math.max(1, Math.ceil((totalItems || filteredMarks.length) / itemsPerPage));
  const currentMarks = filteredMarks;
  const normalizeMark = (item) => ({
    ...item,
    id: item.id,
    title: item.title || 'بدون عنوان',
    images: (item.images || []).map((image, index) => normalizeGuidanceImage(image, index)),
    location: { lat: Number(item.latitude), lng: Number(item.longitude) },
    x: item.x,
    y: item.y,
    floor: item.floor
  });
  const fetchMarks = async ({ page = currentPage } = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(itemsPerPage));
      if (searchTerm?.trim()) params.set('search', searchTerm.trim());
      const res = await apiAdmin.get(`/api/v1/admin/guidance-points?${params.toString()}`);
      const payload = res.data;
      if (!payload?.success) throw new Error(payload?.message || 'خطا در دریافت لیست نقاط');
      const list = Array.isArray(payload?.data) ? payload.data : [];
      setMarks(list.map(normalizeMark));
      setTotalItems(Number(payload?.meta?.total || list.length));
    } catch (err) {
      toast.error(err.message || 'خطا در دریافت لیست نقاط');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  useEffect(() => { fetchMarks({ page: currentPage }); }, [currentPage, itemsPerPage]);

  // Initialize map function
  const initializeMap = (lat, lng) => {
    if (!mapContainerRef.current) {
      console.error('Map container not found');
      return;
    }

    // Remove existing map if any
    if (mapRef.current) {
      try {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        mapRef.current.remove();
      } catch (err) {
        console.warn('Error removing existing map:', err);
      }
      mapRef.current = null;
    }

    // Initialize RTL plugin
    ensureRtlOnce();

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: './map-styles/osm-voyager/style-en.json',
        center: [lng, lat],
        zoom: 16
      });

      map.addControl(new maplibregl.NavigationControl());

      map.on('load', () => {
        console.log('Map loaded successfully');

        // Add marker with custom red marker
        if (markerRef.current) {
          markerRef.current.remove();
        }

        markerRef.current = new maplibregl.Marker({
          element: createRedMarker(),
          draggable: true
        })
          .setLngLat([lng, lat])
          .addTo(map);

        // Handle marker drag end
        markerRef.current.on('dragend', () => {
          const lngLat = markerRef.current.getLngLat();
          const newLocation = { lat: lngLat.lat, lng: lngLat.lng };
          setSelectedLocation(newLocation);
          setFormData(prev => ({ ...prev, location: newLocation }));
        });

        // Handle map click to place marker
        map.on('click', (e) => {
          const { lng, lat } = e.lngLat;
          const newLocation = { lat, lng };

          if (markerRef.current) {
            markerRef.current.setLngLat([lng, lat]);
          } else {
            markerRef.current = new maplibregl.Marker({
              element: createRedMarker(),
              draggable: true
            })
              .setLngLat([lng, lat])
              .addTo(map);

            markerRef.current.on('dragend', () => {
              const lngLat = markerRef.current.getLngLat();
              const draggedLocation = { lat: lngLat.lat, lng: lngLat.lng };
              setSelectedLocation(draggedLocation);
              setFormData(prev => ({ ...prev, location: draggedLocation }));
            });
          }

          setSelectedLocation(newLocation);
          setFormData(prev => ({ ...prev, location: newLocation }));
        });
      });

      mapRef.current = map;

      // Force resize after map loads
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      }, 200);

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('خطا در بارگذاری نقشه');
    }
  };

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Resize map when modal becomes visible
  useEffect(() => {
    if ((isAddModalOpen || isEditModalOpen) && mapRef.current) {
      const timeoutId = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [isAddModalOpen, isEditModalOpen]);

  // Close orientation modal
  const closeOrientationModal = () => {
    setShowOrientationModal(false);
    setPendingImageFile(null);
    setSelectedOrientation('unknown');
    setPendingImageCallback(null);
  };

  // Handle orientation select
  const handleOrientationSelect = (orientation) => {
    if (!pendingImageFile) return;

    // Create the image object with orientation
    const newImage = normalizeGuidanceImage({
      id: Date.now() + Math.random(),
      file: pendingImageFile.file,
      previewUrl: pendingImageFile.url,
      image_url: pendingImageFile.url,
      url: pendingImageFile.url,
      view_orientation: orientation || 'unknown',
      azimuth_deg: ORIENTATION_TO_AZIMUTH[orientation || 'unknown'],
      fov_deg: 60,
      caption: '',
      name: pendingImageFile.name,
      size: pendingImageFile.size,
      type: pendingImageFile.type || pendingImageFile.file?.type || '',
      mime: pendingImageFile.type || pendingImageFile.file?.type || ''
    }, formData.images.length);

    // Add to form data using the callback
    if (pendingImageCallback) {
      pendingImageCallback(newImage);
    }

    // Reset orientation modal state
    closeOrientationModal();
  };

  // Handle image upload with orientation modal
  const handleImageUploadWithOrientation = (e, callback) => {
    const files = Array.from(e.target.files);
    const remainingSlots = 4 - formData.images.length;

    if (files.length > remainingSlots) {
      toast.error(`حداکثر می‌توانید ${remainingSlots} تصویر دیگر آپلود کنید`);
      e.target.value = '';
      return;
    }

    // Process each file
    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('حجم تصویر باید کمتر از 2 مگابایت باشد');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        // Store pending image and callback
        setPendingImageFile({
          file,
          url: reader.result,
          name: file.name,
          size: file.size,
          type: file.type
        });
        setPendingImageCallback(() => callback);
        setShowOrientationModal(true);
      };
      reader.readAsDataURL(file);
    });

    // Reset file input
    e.target.value = '';
  };

  // Open add modal
  const openAddModal = () => {
    setFormData({
      title: '',
      images: [],
      location: null,
      floor: 0
    });
    setSelectedLocation(null);
    setDeletedImages([]);
    setIsAddModalOpen(true);

    // Initialize map after modal is rendered
    setTimeout(() => {
      if (mapContainerRef.current) {
        initializeMap(36.2880, 59.6157);
      }
    }, 150);
  };

  // Open edit modal
  const openEditModal = (mark) => {
    setSelectedMark(mark);
    setFormData({
      title: mark.title,
      images: (mark.images || []).map((image, index) => normalizeGuidanceImage(image, index)),
      location: mark.location
    });
    setSelectedLocation(mark.location);
    setDeletedImages([]);
    setIsEditModalOpen(true);

    setTimeout(() => {
      if (mapContainerRef.current && mark.location) {
        initializeMap(mark.location.lat, mark.location.lng);
      }
    }, 150);
  };

  // Open delete modal
  const openDeleteModal = (mark) => {
    setSelectedMark(mark);
    setIsDeleteModalOpen(true);
  };

  // Handle image upload for add modal
  const handleAddImageUpload = (e) => {
    const addImageToForm = (newImage) => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newImage]
      }));
    };
    handleImageUploadWithOrientation(e, addImageToForm);
  };

  // Handle image upload for edit modal
  const handleEditImageUpload = (e) => {
    const addImageToForm = (newImage) => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, newImage]
      }));
    };
    handleImageUploadWithOrientation(e, addImageToForm);
  };

  // Remove image
  const removeImage = (indexToRemove) => {
    setFormData((prev) => {
      const imageToRemove = prev.images[indexToRemove];

      const persistedPath = resolvePersistedImagePath(imageToRemove);

      if (persistedPath) {
        setDeletedImages((current) => {
          const alreadyExists = current.some((img) => {
            const currentPath = resolvePersistedImagePath(img) || img.path || img.image_key;
            return currentPath === persistedPath;
          });

          if (alreadyExists) return current;

          return [
            ...current,
            {
              id: imageToRemove.id || null,
              path: persistedPath,
              image_key: persistedPath,
              url: imageToRemove.url || imageToRemove.image_url || null
            }
          ];
        });
      }

      return {
        ...prev,
        images: prev.images.filter((_, index) => index !== indexToRemove)
      };
    });
  };



  const updateImageOrientation = (index, orientation) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, idx) => idx !== index ? img : {
        ...img,
        view_orientation: orientation,
        azimuth_deg: ORIENTATION_TO_AZIMUTH[orientation],
      })
    }));
  };

  const deleteRemovedGuidancePointImages = async (images) => {
    const uniquePaths = [
      ...new Set(
        images
          .map((img) => img?.image_key || img?.path || resolvePersistedImagePath(img))
          .filter(Boolean)
      )
    ];

    for (const path of uniquePaths) {
      await deleteFile(path);
    }
  };

  // Handle add mark (title no longer mandatory)
  // Handle add mark (title no longer mandatory)
  const handleAddMark = () => {
    // Only check location, title is optional
    if (!formData.location) {
      toast.error('لطفا موقعیت را روی نقشه انتخاب کنید');
      return;
    }

    setIsSaving(true);

    const request = new FormData();
    request.append('floor', String(formData.floor ?? 0));
    request.append('title', formData.title?.trim() || '');
    request.append('x', String(formData.location.lng));
    request.append('y', String(formData.location.lat));
    appendGuidanceImagesToFormData(request, formData.images);
    apiAdmin.post('/api/v1/admin/guidance-points', request).then(async (res) => {
      const payload = res.data;
      if (!payload?.success) throw new Error(payload?.message || 'خطا در ایجاد نقطه');

      setIsSaving(false);
      setIsAddModalOpen(false);
      setDeletedImages([]);
      toast.success('نقطه جدید با موفقیت اضافه شد');
      setCurrentPage(1);
      fetchMarks({ page: 1 });
      setFormData({
        title: '',
        images: [],
        location: null,
        floor: 0
      });
    }).catch((err) => {
      setIsSaving(false);
      toast.error(err.message || 'خطا در ایجاد نقطه');
    });
  };

  // Handle edit mark (title no longer mandatory)
  const handleEditMark = () => {
    // Only check location, title is optional
    if (!formData.location) {
      toast.error('لطفا موقعیت را روی نقشه انتخاب کنید');
      return;
    }

    setIsSaving(true);

    const request = new FormData();
    request.append('floor', String(formData.floor ?? selectedMark?.floor ?? 0));
    request.append('title', formData.title?.trim() || '');
    const currentLng = Number(formData.location?.lng);
    const currentLat = Number(formData.location?.lat);
    const originalLng = Number(selectedMark?.location?.lng);
    const originalLat = Number(selectedMark?.location?.lat);

    const locationChanged =
      Number.isFinite(currentLng) &&
      Number.isFinite(currentLat) &&
      (
        Math.abs(currentLng - originalLng) > 0.0000001 ||
        Math.abs(currentLat - originalLat) > 0.0000001
      );

    if (locationChanged) {
      request.append('x', String(currentLng));
      request.append('y', String(currentLat));
    }
    appendGuidanceImagesToFormData(request, formData.images);
    appendExistingGuidanceImageMetaToFormData(request, formData.images);

    apiAdmin.post(
      `/api/v1/admin/guidance-points/${selectedMark.id}`,
      request,
      {
        headers: {
          Accept: 'application/json'
        }
      }
    ).then(async (res) => {
      const payload = res.data;

      if (!payload?.success) {
        throw new Error(payload?.message || 'خطا در ویرایش نقطه');
      }

      if (deletedImages.length > 0) {
        await deleteRemovedGuidancePointImages(deletedImages);
      }

      setIsSaving(false);
      setIsEditModalOpen(false);
      setDeletedImages([]);
      toast.success('نقطه با موفقیت ویرایش شد');
      fetchMarks({ page: currentPage });
    }).catch((err) => {
      console.error('Edit guidance point failed:', err);
      setIsSaving(false);
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        'خطا در ویرایش نقطه'
      );
    });
  };

  // Handle delete mark
  const handleDeleteMark = () => {
    setIsSaving(true);

    apiAdmin.delete(`/api/v1/admin/guidance-points/${selectedMark.id}`).then((res) => {
      const payload = res.data;
      if (!payload?.success) throw new Error(payload?.message || 'خطا در حذف نقطه');
      setIsSaving(false);
      setIsDeleteModalOpen(false);
      setDeletedImages([]);
      toast.success('نقطه با موفقیت حذف شد');
      fetchMarks({ page: currentPage });
    }).catch((err) => {
      setIsSaving(false);
      toast.error(err.message || 'خطا در حذف نقطه');
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);

    fetchMarks({ page: currentPage }).then(() => toast.success('لیست نقاط به‌روزرسانی شد'));
  };

  // Pagination handlers
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const appendExistingGuidanceImageMetaToFormData = (fd, images) => {
    images
      .filter((img) => !(img.file instanceof File) && img.id)
      .forEach((img, index) => {
        const orientation = img.view_orientation || 'unknown';
        const azimuth = img.azimuth_deg !== undefined && img.azimuth_deg !== null
          ? img.azimuth_deg
          : ORIENTATION_TO_AZIMUTH[orientation];

        fd.append(`existing_image_ids[${index}]`, String(img.id));
        fd.append(`existing_image_orientations[${index}]`, orientation);
        fd.append(
          `existing_image_azimuths[${index}]`,
          azimuth === null || azimuth === undefined || azimuth === '' ? '' : String(azimuth)
        );
        fd.append(`existing_image_fovs[${index}]`, String(img.fov_deg || 60));
        fd.append(`existing_image_captions[${index}]`, img.caption || '');
      });
  };

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let startRange = currentPage - delta;
      let endRange = currentPage + delta;

      if (startRange <= 2) {
        startRange = 2;
        endRange = Math.min(totalPages - 1, startRange + (delta * 2));
      }

      if (endRange >= totalPages - 1) {
        endRange = totalPages - 1;
        startRange = Math.max(2, endRange - (delta * 2));
      }

      if (startRange > 2) {
        pages.push('...');
      }

      for (let i = startRange; i <= endRange; i++) {
        pages.push(i);
      }

      if (endRange < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  // Truncate text function
  const truncateText = (text, wordLimit = 7) => {
    const words = text.split(/\s+/);
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return text;
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>مدیریت نقاط راهنما</h3>
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
                placeholder="جستجوی عنوان..."
                value={searchTerm}
                onChange={(e) => {
                  setCurrentPage(1);
                  setSearchTerm(e.target.value);
                }}
                className="search-input7"
              />
            </div>
            <button className="add-admin-btn" onClick={openAddModal}>
              اضافه کردن نقطه راهنمای جدید
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.0003 18.3334C14.6027 18.3334 18.3337 14.6024 18.3337 10C18.3337 5.39765 14.6027 1.66669 10.0003 1.66669C5.39795 1.66669 1.66699 5.39765 1.66699 10C1.66699 14.6024 5.39795 18.3334 10.0003 18.3334ZM10.6253 7.50002C10.6253 7.15484 10.3455 6.87502 10.0003 6.87502C9.65515 6.87502 9.37533 7.15484 9.37533 7.50002L9.37532 9.37504H7.50033C7.15515 9.37504 6.87533 9.65486 6.87533 10C6.87533 10.3452 7.15515 10.625 7.50033 10.625H9.37532V12.5C9.37532 12.8452 9.65515 13.125 10.0003 13.125C10.3455 13.125 10.6253 12.8451 10.6253 12.5L10.6253 10.625H12.5003C12.8455 10.625 13.1253 10.3452 13.1253 10C13.1253 9.65486 12.8455 9.37504 12.5003 9.37504H10.6253V7.50002Z" fill="white" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Marks Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>تصویر</th>
              <th>عنوان</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                  در حال بارگذاری...
                </td>
              </tr>
            ) : currentMarks.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                  نقطه‌ای یافت نشد
                </td>
              </tr>
            ) : (
              currentMarks.map(mark => (
                <tr key={mark.id}>
                  <td>
                    <div className="user-profile-cell">
                      <div className="profile-image-small2" style={{ position: 'relative' }}>
                        <img
                          src={mark.images[0]?.url || mark.images[0]}
                          alt={mark.title}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        {getImageOrientation(mark.images[0]) && (
                          <span style={{
                            position: 'absolute',
                            bottom: '-8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0, 0, 0, 0.75)',
                            color: '#fff',
                            fontSize: '9px',
                            borderRadius: '8px',
                            padding: '1px 5px',
                            whiteSpace: 'nowrap'
                          }}>
                            {getDirectionLabel(getImageOrientation(mark.images[0]))}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="username-cell-marks">{truncateText(mark.title, 8)}</span>
                  </td>
                  <td>
                    <div className="Marks-admin-actions">
                      <button
                        className="edit-btn21"
                        onClick={() => openEditModal(mark)}
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
                        onClick={() => openDeleteModal(mark)}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M3.41092 5.1678C3.68645 5.14943 3.9247 5.3579 3.94307 5.63343L4.24969 10.2328C4.3096 11.1314 4.35228 11.7566 4.446 12.227C4.5369 12.6833 4.66379 12.9249 4.84606 13.0954C5.02834 13.2659 5.27777 13.3765 5.73911 13.4368C6.21471 13.499 6.84138 13.5 7.74194 13.5H8.25752C9.15808 13.5 9.78475 13.499 10.2604 13.4368C10.7217 13.3765 10.9711 13.2659 11.1534 13.0954C11.3357 12.9249 11.4626 12.6833 11.5535 12.227C11.6472 11.7566 11.6899 11.1314 11.7498 10.2328L12.0564 5.63343C12.0748 5.3579 12.313 5.14943 12.5885 5.1678C12.8641 5.18617 13.0725 5.42442 13.0542 5.69995L12.7452 10.3345C12.6882 11.1896 12.6422 11.8804 12.5342 12.4224C12.4219 12.986 12.231 13.4567 11.8366 13.8256C11.4422 14.1946 10.9598 14.3538 10.3901 14.4284C9.84203 14.5001 9.14973 14.5 8.29268 14.5H7.70679C6.84973 14.5 6.15743 14.5001 5.60941 14.4284C5.03964 14.3538 4.55727 14.1946 4.16288 13.8256C3.76848 13.4567 3.57753 12.986 3.46527 12.4224C3.35729 11.8804 3.31125 11.1896 3.25425 10.3344L2.94528 5.69995C2.92691 5.42442 3.13538 5.18617 3.41092 5.1678Z" fill="#1E2023" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M6.90324 1.50003L6.87258 1.50001C6.72832 1.49992 6.60264 1.49984 6.48396 1.51879C6.01509 1.59366 5.60936 1.8861 5.39006 2.30723C5.33456 2.41382 5.29489 2.53309 5.24935 2.66998L5.23967 2.69905L5.17495 2.89323C5.16229 2.93121 5.15876 2.94168 5.15569 2.95016C5.03894 3.2729 4.73626 3.49106 4.39316 3.49976C4.38414 3.49999 4.37309 3.50003 4.33306 3.50003H2.33301C2.05687 3.50003 1.83301 3.72388 1.83301 4.00003C1.83301 4.27617 2.05687 4.50003 2.33301 4.50003L4.33877 4.50003L4.34993 4.50003H11.6495L11.6607 4.50003L13.6664 4.50003C13.9425 4.50003 14.1664 4.27617 14.1664 4.00003C14.1664 3.72388 13.9425 3.50003 13.6664 3.50003H11.6664C11.6264 3.50003 11.6153 3.49999 11.6063 3.49976C11.2632 3.49106 10.9605 3.27289 10.8438 2.95014C10.8407 2.94172 10.8371 2.93102 10.8245 2.89323L10.7598 2.69905L10.7501 2.66996C10.7046 2.53307 10.6649 2.41382 10.6094 2.30723C10.3901 1.8861 9.98437 1.59366 9.5155 1.51879C9.39682 1.49984 9.27114 1.49992 9.12688 1.50001L9.09622 1.50003H6.90324ZM6.09606 3.29032C6.06988 3.36269 6.03945 3.43268 6.00511 3.50003H9.99435C9.96001 3.43268 9.92959 3.3627 9.90341 3.29033L9.8776 3.21477L9.8111 3.01528C9.75032 2.83294 9.73633 2.79575 9.72245 2.76909C9.64935 2.62872 9.5141 2.53124 9.35781 2.50628C9.32813 2.50154 9.28843 2.50003 9.09622 2.50003H6.90324C6.71103 2.50003 6.67133 2.50154 6.64165 2.50628C6.48536 2.53124 6.35011 2.62872 6.27701 2.76909C6.26313 2.79575 6.24914 2.83294 6.18836 3.01528L6.12182 3.21489C6.1118 3.24495 6.10401 3.26834 6.09606 3.29032Z" fill="#1E2023" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!isLoading && (
          <div className="pagination-container">
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
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    className={`page-number ${currentPage === page ? 'active' : ''} ${page === '...' ? 'ellipsis' : ''}`}
                    onClick={() => page !== '...' && handlePageChange(page)}
                    disabled={page === '...'}
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

      {/* Add Mark Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="add-admin-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header-add-admin">
              <h3>افزودن نقطه راهنما</h3>
              <button
                className="close-btn"
                onClick={() => { setIsAddModalOpen(false); setDeletedImages([]); }}
              >
                ×
              </button>
            </div>
            <div className="modal-body-add-admin">
              <div className="Marks-admin-basic-info">
                <div className="info-field">
                  <label>عنوان</label>
                  <input
                    type="text"
                    className="form-input-add-admin"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="عنوان مکان را وارد کنید "
                  />
                </div>
                <div className="info-field">
                  <label>تصاویر (حداکثر 4 عدد)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAddImageUpload}
                    className="form-input-add-admin"
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {formData.images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={img.previewUrl || img.url || img.image_url} alt={`preview-${idx}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                        {
                          <div style={{
                            position: 'absolute',
                            bottom: '-5px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            {`${getDirectionLabel(img.view_orientation)}${img.azimuth_deg !== null && img.azimuth_deg !== undefined ? ` - ${img.azimuth_deg}°` : ''}`}
                          </div>
                        }
                        <select
                          value={img.view_orientation || 'unknown'}
                          onChange={(e) => updateImageOrientation(idx, e.target.value)}
                          style={{ position: 'absolute', left: 0, top: '84px', fontSize: '11px' }}
                        >
                          {ORIENTATION_OPTIONS.map((option) => <option key={option} value={option}>{ORIENTATION_LABELS_FA[option]}</option>)}
                        </select>
                        <button
                          onClick={() => removeImage(idx)}
                          style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="info-field">
                  <label>موقعیت روی نقشه <span style={{ color: 'red' }}>*</span></label>
                  <div
                    ref={mapContainerRef}
                    style={{
                      width: '100%',
                      height: '250px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                  <div className="map-instruction" style={{ marginTop: '10px' }}>
                    <span>برای انتخاب موقعیت دقیق، روی نقشه کلیک کنید</span>
                    {selectedLocation && (
                      <div className="selected-coordinates">
                        <span>موقعیت انتخاب شده:</span>
                        <span className="coordinates-value">
                          {selectedLocation.lat.toFixed(6)}°N, {selectedLocation.lng.toFixed(6)}°E
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer-add-admin">
              <button
                className="cancel-btn-add-admin"
                onClick={() => { setIsAddModalOpen(false); setDeletedImages([]); }}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="action-btn save-btn"
                onClick={handleAddMark}
                disabled={isSaving || !formData.location}
              >
                {isSaving ? 'در حال ذخیره...' : 'افزودن نقطه راهنما'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mark Modal */}
      {isEditModalOpen && selectedMark && (
        <div className="modal-overlay">
          <div className="add-admin-modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header-add-admin">
              <h3>ویرایش نقطه راهنما</h3>
              <button
                className="close-btn"
                onClick={() => { setIsEditModalOpen(false); setDeletedImages([]); }}
              >
                ×
              </button>
            </div>
            <div className="modal-body-add-admin">
              <div className="Marks-admin-basic-info">
                <div className="info-field">
                  <label>عنوان</label>
                  <input
                    type="text"
                    className="form-input-add-admin"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="عنوان مکان را وارد کنید (اختیاری)"
                  />
                </div>
                <div className="info-field">
                  <label>تصاویر (حداکثر 4 عدد)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditImageUpload}
                    className="form-input-add-admin"
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {formData.images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img src={img.previewUrl || img.url || img.image_url} alt={`preview-${idx}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
                        {
                          <div style={{
                            position: 'absolute',
                            bottom: '-5px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            {`${getDirectionLabel(img.view_orientation)}${img.azimuth_deg !== null && img.azimuth_deg !== undefined ? ` - ${img.azimuth_deg}°` : ''}`}
                          </div>
                        }
                        <select
                          value={img.view_orientation || 'unknown'}
                          onChange={(e) => updateImageOrientation(idx, e.target.value)}
                          style={{ position: 'absolute', left: 0, top: '84px', fontSize: '11px' }}
                        >
                          {ORIENTATION_OPTIONS.map((option) => <option key={option} value={option}>{ORIENTATION_LABELS_FA[option]}</option>)}
                        </select>
                        <button
                          onClick={() => removeImage(idx)}
                          style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="info-field">
                  <label>موقعیت روی نقشه <span style={{ color: 'red' }}>*</span></label>
                  <div
                    ref={mapContainerRef}
                    style={{
                      width: '100%',
                      height: '250px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                  <div className="map-instruction" style={{ marginTop: '10px' }}>
                    <span>برای تغییر موقعیت، روی نقشه کلیک کنید</span>
                    {selectedLocation && (
                      <div className="selected-coordinates">
                        <span>موقعیت انتخاب شده:</span>
                        <span className="coordinates-value">
                          {selectedLocation.lat.toFixed(6)}°N, {selectedLocation.lng.toFixed(6)}°E
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer-add-admin">
              <button
                className="cancel-btn-add-admin"
                onClick={() => { setIsEditModalOpen(false); setDeletedImages([]); }}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="action-btn save-btn"
                onClick={handleEditMark}
                disabled={isSaving || !formData.location}
              >
                {isSaving ? 'در حال ذخیره...' : 'ویرایش نقطه راهنما'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedMark && (
        <div className="modal-overlay">
          <div className="delete-admin-modal">
            <div className="modal-header-delete-admin">
            </div>
            <div className="modal-body-delete-admin">
              <h4>آیا از حذف این نقطه راهنما مطمئن هستید؟</h4>
            </div>
            <div className="modal-footer-delete-admin">
              <button
                className="action-btn cancel-delete-btn"
                onClick={() => { setIsDeleteModalOpen(false); setDeletedImages([]); }}
                disabled={isSaving}
              >
                انصراف
              </button>
              <button
                className="action-btn confirm-delete-btn"
                onClick={handleDeleteMark}
                disabled={isSaving}
              >
                {isSaving ? 'در حال حذف...' : 'حذف نقطه راهنما'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orientation Selection Modal */}
      {showOrientationModal && pendingImageFile && (
        <div className="modal-overlay">
          <div className="orientation-modal">
            <div className="modal-header">
              <h3>انتخاب زاویه عکس</h3>
              <button
                onClick={closeOrientationModal}
                style={{
                  position: 'absolute',
                  left: '15px',
                  top: '15px',
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="image-preview-container">
                <img
                  src={pendingImageFile.url}
                  alt="Preview"
                  className="image-preview"
                />
              </div>

              {selectedOrientation && (
                <div style={{ marginTop: '12px', textAlign: 'center', fontWeight: 600, color: '#1E2023' }}>
                  جهت انتخاب شده: {getDirectionLabel(selectedOrientation)}
                </div>
              )}

              <div className="orientation-options-grid">
                {ORIENTATION_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={`orientation-option ${selectedOrientation === option ? 'selected' : ''}`}
                    onClick={() => setSelectedOrientation(option)}
                  >
                    <span>{getDirectionLabel(option)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={closeOrientationModal}
              >
                انصراف
              </button>
              <button
                className="confirm-btn"
                onClick={() => selectedOrientation ? handleOrientationSelect(selectedOrientation) : null}
                disabled={!selectedOrientation}
                style={{ opacity: !selectedOrientation ? 0.5 : 1 }}
              >
                تایید و ادامه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marks;
