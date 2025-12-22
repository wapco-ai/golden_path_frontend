import axios from 'axios';
import appConfig from '../../config/appConfig';

const publicApi = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/api/v1`,
  headers: {
    Accept: 'application/json'
  }
});

export default publicApi;
