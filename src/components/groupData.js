// src/data/groupData.js

import s1 from '/img/s1.jpg';
import s2 from '/img/s2.jpg';
import s3 from '/img/s3.jpg';
import s4 from '/img/s4.jpg';
import s5 from '/img/s5.jpg';
import s6 from '/img/s6.jpg';
import s7 from '/img/s7.jpg';
import s8 from '/img/s8.jpg';
import s9 from '/img/s9.jpg';
import s10 from '/img/s10.png';
import s11 from '/img/s11.jpg';
import s12 from '/img/s12.jpg';
import s13 from '/img/s13.png';
import s14 from '/img/s14.jpg';
import s15 from '/img/s15.jpg';
import s16 from '/img/s16.jpg';
import s17 from '/img/s17.jpg';
import s18 from '/img/s18.jpg';
import s19 from '/img/s19.jpg';
import s20 from '/img/s20.jpg';
import s21 from '/img/s21.jpg';
import s22 from '/img/s22.jpg';
import s23 from '/img/s23.jpg';
import s24 from '/img/s24.jpg';
import s25 from '/img/s25.jpg';
import s26 from '/img/s26.jpg';
import s27 from '/img/s27.jpg';
import s28 from '/img/s28.jpg';
import s29 from '/img/s29.jpg';
import s30 from '/img/s30.jpeg';
import s31 from '/img/s31.jpg';
import s32 from '/img/s32.jpg';
import s33 from '/img/s33.jpg';
import s34 from '/img/s34.jpg';
import s35 from '/img/s35.png';
import s36 from '/img/s36.jpg';
import s37 from '/img/s37.jpg';
import s38 from '/img/s38.jpg';
import s39 from '/img/s39.jpg';
import s40 from '/img/s40.jpg';
import s41 from '/img/s41.jpg';
import s42 from '/img/s42.jpg';
import s43 from '/img/s43.jpg';
import s44 from '/img/s44.jpg';
import ic1 from '../assets/icons/ic1.png';
import ic2 from '../assets/icons/ic2.png';
import ic3 from '../assets/icons/ic3.png';
import ic4 from '../assets/icons/ic4.png';
import ic5 from '../assets/icons/ic5.png';
import ic6 from '../assets/icons/ic6.png';
import ic7 from '../assets/icons/ic7.png';
import ic8 from '../assets/icons/ic8.png';

export const groups = [
  {
    value: 'sahn',
    label: 'groupCourtyardPlural',
    icon: 'courtyard',
    property: 'group',
    png: ic1
//     svg: `
// <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
// <path d="M2.10815 20.703H7.27717V11.6202C7.27717 9.20064 12.5068 5.23868 12.5068 5.23868C12.5404 5.25908 17.7363 9.1995 17.7363 11.6202V20.703H22.8919V4.27617H21.4819V2.76519C21.4819 1.94408 20.8156 1.27441 19.9945 1.27441H5.01912C4.198 1.27441 3.53165 1.94408 3.53165 2.76519V4.27617H2.10815V20.703ZM23.1494 21.3773H1.85071C1.38087 21.3773 1 21.7582 1 22.228C1 22.6978 1.38087 23.0787 1.85071 23.0787H23.1493C23.6191 23.0787 24 22.6978 24 22.228C24.0001 21.7582 23.6192 21.3773 23.1494 21.3773Z"/>
// </svg>

//     `
  },
  {
    value: 'eyvan',
    label: 'groupEyvanPlural',
    icon: 'eyvan',
    property: 'group',
    png: ic2
    // svg: `<svg width="30" height="30" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    //                 <path d="M2.10815 20.7034H7.27717V11.6207C7.27717 9.2011 12.5068 5.23914 12.5068 5.23914C12.5404 5.25954 17.7363 9.19995 17.7363 11.6207V20.7034H22.8919V4.27663H21.4819V2.76565C21.4819 1.94453 20.8156 1.27487 19.9945 1.27487H5.01912C4.198 1.27487 3.53165 1.94453 3.53165 2.76565V4.27663H2.10815V20.7034ZM23.1494 21.3778H1.85071C1.38087 21.3778 1 21.7586 1 22.2285C1 22.6983 1.38087 23.0792 1.85071 23.0792H23.1493C23.6191 23.0792 24 22.6983 24 22.2285C24.0001 21.7586 23.6192 21.3778 23.1494 21.3778Z"/>
    //             </svg>`
  },
  {
    value: 'ravaq',
    label: 'groupRavaqPlural',
    icon: 'shrine',
    property: 'group',
    png: ic3
//     svg: `
// <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
// <path fill-rule="evenodd" clip-rule="evenodd" d="M10.2073 2.9087C9.5 3.53569 9.5 4.68259 9.5 6.9764V18.0236C9.5 20.3174 9.5 21.4643 10.2073 22.0913C10.9145 22.7183 11.9955 22.5297 14.1576 22.1526L16.4864 21.7465C18.8809 21.3288 20.0781 21.12 20.7891 20.2417C21.5 19.3635 21.5 18.0933 21.5 15.5529V9.44711C21.5 6.90671 21.5 5.63652 20.7891 4.75826C20.0781 3.87999 18.8809 3.67118 16.4864 3.25354L14.1576 2.84736C11.9955 2.47026 10.9145 2.28171 10.2073 2.9087ZM12.5 10.6686C12.9142 10.6686 13.25 11.02 13.25 11.4535V13.5465C13.25 13.98 12.9142 14.3314 12.5 14.3314C12.0858 14.3314 11.75 13.98 11.75 13.5465V11.4535C11.75 11.02 12.0858 10.6686 12.5 10.6686Z"/>
// <path d="M8.04717 5C5.98889 5.003 4.91599 5.04826 4.23223 5.73202C3.5 6.46425 3.5 7.64276 3.5 9.99979V14.9998C3.5 17.3568 3.5 18.5353 4.23223 19.2676C4.91599 19.9513 5.98889 19.9966 8.04717 19.9996C7.99985 19.3763 7.99992 18.6557 8.00001 17.8768V7.1227C7.99992 6.34388 7.99985 5.6233 8.04717 5Z"/>
// </svg>
// `
  },
  {
    value: 'masjed',
    label: 'groupMosques',
    icon: 'mosque',
    property: 'group',
    png: ic4
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h7v-2a2 2 0 1 1 4 0v2h7"/><path d="M4 21v-10"/><path d="M20 21v-10"/><path d="M4 16h3v-3h10v3h3"/><path d="M17 13a5 5 0 0 0 -10 0"/><path d="M21 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z"/><path d="M5 10.5c0 -.329 -.077 -.653 -.224 -.947l-.776 -1.553l-.776 1.553a2.118 2.118 0 0 0 -.224 .947a.5 .5 0 0 0 .5 .5h1a.5 .5 0 0 0 .5 -.5z"/><path d="M12 2a2 2 0 1 0 2 2"/><path d="M12 6v2"/></svg>`
  },
  {
    value: 'madrese',
    label: 'groupSchools',
    icon: 'school',
    property: 'group',
    png: ic5
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/></svg>`
  },
  {
    value: 'khadamat',
    label: 'groupServices',
    icon: 'services',
    property: 'group',
    png: ic6
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`
  },
  {
    value: 'elmi',
    label: 'groupCulture',
    icon: 'culture',
    property: 'group',
    png: ic7
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></svg>`
  },
  {
    value: 'cemetery',
    label: 'groupCemetery',
    icon: 'cemetery',
    property: 'group',
    png: ic8
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4v16"/><path d="M19 4v16"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M3 4h18"/></svg>`
  },
  {
    value: 'qrcode',
    label: 'groupQRScan',
    icon: 'qr-code',
    property: 'nodeFunction',
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 17l0 .01"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 7l0 .01"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M17 7l0 .01"/><path d="M14 14l3 0"/><path d="M20 14l0 .01"/><path d="M14 14l0 3"/><path d="M14 20l3 0"/><path d="M17 17l3 0"/><path d="M20 17l0 3"/></svg>`
  },
  {
    value: 'elevator',
    label: 'groupElevator',
    icon: 'elevator',
    property: 'group',
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M10 10l2 -2l2 2"/><path d="M14 14l-2 2l-2 -2"/></svg>`
  },
  {
    value: 'other',
    label: 'groupOther',
    icon: 'other',
    property: 'group',
    // svg: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 9l3 3l-3 3"/><path d="M13 15l3 0"/><path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/></svg>`
  }
];

export const subGroups = {
  sahn: [
    {
      value: 'sahn-enqelab',
      label: 'صحن انقلاب',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s37, s38, s1],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '150',
      time: '2',
      rating: 3.6,
      views: 17
    },
    {
      value: 'sahn-azadi',
      label: 'صحن آزادی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s41, s40, s39],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '200',
      time: '3',
      rating: 4.7,
      views: 17
    },
    {
      value: 'sahn-jomhouri',
      label: 'صحن جمهوری اسلامی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s3, s4, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '180',
      time: '2.5',
      rating: 3.7,
      views: 17
    },
    {
      value: 'sahn-qods',
      label: 'صحن قدس',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s4, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '220',
      time: '3.5',
      rating: 5.0,
      views: 56
    },
    {
      value: 'sahn-jame-razavi',
      label: 'صحن جامع رضوی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s5, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '170',
      time: '2.2',
      rating: 4.4,
      views: 44
    },
    {
      value: 'sahn-ghadir',
      label: 'صحن غدیر',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s6, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '190',
      time: '2.8',
      rating: 3.9,
      views: 53
    },
    {
      value: 'sahn-kosar',
      label: 'صحن کوثر',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s7, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '210',
      time: '3.2',
      rating: 2.7,
      views: 11
    },
    {
      value: 'sahn-emam-hasan',
      label: 'صحن امام حسن ',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s8, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '160',
      time: '2.1',
      rating: 4.7,
      views: 11
    },
    {
      value: 'sahn-payambar-azam',
      label: 'صحن پیامبر اعظم',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s9, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '230',
      time: '3.7',
      rating: 3.7,
      views: 19
    }
  ],
  eyvan: [
    {
      value: 'eyvan-abbasi',
      label: 'ایوان عباسی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s42, s43, s44],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '120',
      time: '1.8',
      rating: 4.1,
      views: 41
    },
    {
      value: 'eyvan-talayi',
      label: 'ایوان طلایی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s33, s34, s35],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '140',
      time: '2.1',
      rating: 4.7,
      views: 120
    },
    {
      value: 'eyvan-saat',
      label: 'ایوان ساعت',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s12, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '110',
      time: '1.6',
      rating: 5.0,
      views: 66
    },
    {
      value: 'eyvan-naqare',
      label: 'ایوان نقاره',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s13, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '130',
      time: '1.9',
      rating: 4.7,
      views: 37
    },
    {
      value: 'eyvan-valiasr',
      label: 'ایوان ولیعصر',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s14, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '125',
      time: '1.8',
      rating: 3.9,
      views: 28
    },
    {
      value: 'eyvan-talaye-azadi',
      label: 'ایوان طلای آزادی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s15, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '135',
      time: '2.0',
      rating: 2.7,
      views: 2
    }
  ],
  ravaq: [
    {
      value: 'daralhefaz',
      label: 'دارالحفاظ',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s16, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '90',
      time: '1.3',
      rating: 3.1,
      views: 23
    },
    {
      value: 'daralsiade',
      label: 'دارالسياده',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s17, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '85',
      time: '1.2',
      rating: 3.7,
      views: 46
    },
    {
      value: 'daralsalam',
      label: 'دارالسلام',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s18, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '95',
      time: '1.4',
      rating: 4.3,
      views: 32
    },
    {
      value: 'hatamkhani',
      label: 'حاتم خانی',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s19, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '80',
      time: '1.1',
      rating: 3.2,
      views: 15
    },
    {
      value: 'gonbadallahverdi',
      label: 'گنبدالله وردی خان',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s20, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '100',
      time: '1.5',
      rating: 4.7,
      views: 21
    },
    {
      value: 'daralziafe',
      label: 'دارالضیافه',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s21, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '88',
      time: '1.3',
      rating: 3.7,
      views: 17
    },
    {
      value: 'tohidkhane',
      label: 'توحیدخانه',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s22, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '92',
      time: '1.4',
      rating: 3.0,
      views: 12
    },
    {
      value: 'daralfeyz',
      label: 'دارالفیض',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s23, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '87',
      time: '1.3',
      rating: 5.0,
      views: 47
    },
    {
      value: 'daralsaade',
      label: 'دارالسعاده',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s24, s28, s29],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '83',
      time: '1.2',
      rating: 4.0,
      views: 19
    },
    {
      value: 'goharsad',
      label: 'گوهرشاد',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s25, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '78',
      time: '1.1',
      rating: 3.5,
      views: 24
    }
  ],
  masjed: [
    {
      value: 'balasar',
      label: 'بالاسر',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s26, s2, s3,s3,s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '50',
      time: '0.8',
      rating: 3.7,
      views: 17
    },
    {
      value: 'goharsad',
      label: 'گوهرشاد',
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s27, s2, s3],
      address: 'ضریح مطهر اما رضا(ع)',
      distance: '65',
      time: '1.0',
      rating: 4.7,
      views: 32
    }
  ],
  madrese: [
    {
      value: 'payeen-khyaban',
      label: 'پایین خیابان',
      icon: 'school',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'bala-khyaban',
      label: 'بالا خیابان',
      icon: 'school',
      svg: `<svg xmlns="http://www.w3.org/24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'navvab',
      label: 'نواب',
      icon: 'school',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'dodar',
      label: 'دودر',
      icon: 'school',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6"/><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4"/></svg>`,
      description: "subgroupDefaultDesc"
    }
  ],
  khadamat: [
    {
      value: 'wc',
      label: 'دستشویی',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'telephon',
      label: 'تلفن',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'otag-madadjo',
      label: 'اتاق مددجو',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'namaazkhane',
      label: 'نمازخانه',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'ketabkhane',
      label: 'کتابخانه',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'room',
      label: 'اتاق',
      icon: 'services',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/></svg>`,
      description: "subgroupDefaultDesc"
    }
  ],
  elmi: [
    {
      value: 'hoze-elmiye',
      label: 'حوزه علمیه',
      icon: 'culture',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'markaz-motaleat',
      label: 'مرکز مطالعات',
      icon: 'culture',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'uni',
      label: 'دانشگاه',
      icon: 'culture',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/></svg>`,
      description: "subgroupDefaultDesc"
    }
  ],
  cemetery: [
    {
      value: 'cemetery',
      label: 'قبر',
      icon: 'cemetery',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4v16"/><path d="M19 4v16"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M3 4h18"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'yadbod',
      label: 'یادبود',
      icon: 'cemetery',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 4v16"/><path d="M19 4v16"/><path d="M9 4v16"/><path d="M15 4v16"/><path d="M3 4h18"/></svg>`,
      description: "subgroupDefaultDesc"
    }
  ],
  qrcode: [
    {
      value: 'bakhsh-control',
      label: 'بخش کنترل',
      icon: 'qr-code',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 17l0 .01"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 7l0 .01"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M17 7l0 .01"/><path d="M14 14l3 0"/><path d="M20 14l0 .01"/><path d="M14 14l0 3"/><path d="M14 20l3 0"/><path d="M17 17l3 0"/><path d="M20 17l0 3"/></svg>`,
      description: "subgroupDefaultDesc"
    },
    {
      value: 'cctv',
      label: 'دوربین مدار بسته',
      icon: 'qr-code',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 17l0 .01"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M7 7l0 .01"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M17 7l0 .01"/><path d="M14 14l3 0"/><path d="M20 14l0 .01"/><path d="M14 14l0 3"/><path d="M14 20l3 0"/><path d="M17 17l3 0"/><path d="M20 17l0 3"/></svg>`,
      description: "subgroupDefaultDesc"
    }
  ],
  elevator: [],
  other: [
    {
      value: 'other',
      label: 'سایر',
      icon: 'other',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M8 9l3 3l-3 3"/><path d="M13 15l3 0"/><path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/></svg>`,
      description: "subgroupDefaultDesc",
    },
    {
      value: 'rozemonavare',
      label: "ضریح ",
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s33, s34, s35, s36],
      address: ' حرم مطهر ',
      distance: '190',
      time: '2.8',
      rating: 3.9,
      views: 53
    },
    {
      value: 'saghakhaneh',
      label: "سقاخانه رضوی",
      icon: '',
      svg: ``,
      description: "توضیحات",
      img: [s30, s31, s32],
      address: ' صحن انقلاب  ',
      distance: '190',
      time: '2.8',
      rating: 3.9,
      views: 53
    }
  ]
};