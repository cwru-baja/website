import * as React from 'react';
import { useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import {Routes, Route, useLocation} from 'react-router-dom';
import './App.css';
import Home from './pages/Home/Home.tsx';
import '@mantine/core/styles.css';
import Car from "./pages/Car/Car.tsx";
import { createTheme } from '@mantine/core';

const Team = React.lazy(() => import('./pages/Team/Team.tsx'));
const Support = React.lazy(() => import('./pages/Support/Support.tsx'));
const Competition = React.lazy(() => import('./pages/Competition/Competition.tsx'));
const Social = React.lazy(() => import('./pages/Social/Social.tsx'));

export const theme = createTheme({
  fontFamily: 'Rajdhani, sans-serif',
  headings: {
    fontWeight: '650'
  },
  colors: {
    dark: [
      '#ADADB0',
      '#8F9095',
      '#797B80',
      '#4A4D54',
      '#2A2C32',
      '#212228',
      '#1A1B20',
      '#121316',
      '#0D0E10',
      '#08090A'
    ],
    red: [
      '#FFE5E8',
      '#FDC8CE',
      '#F7AAB3',
      '#F18C99',
      '#EA6E7F',
      '#E25365',
      '#C93B4E',
      '#A90A1C',
      '#8C0716',
      '#67050F'
    ]
  },
  primaryColor: 'red',
  primaryShade: 7
});

function App() {
  const location = useLocation();
  useEffect(() => {
    const preloadPages = () => {
      import('./pages/Team/Team.tsx');
      import('./pages/Support/Support.tsx');
      import('./pages/Competition/Competition.tsx');
      import('./pages/Social/Social.tsx');
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadPages);
    } else {
      setTimeout(preloadPages, 1000);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/home' element={<Home />} />
        <Route path='/team' element={<Team />} />
        <Route path='/car' element={<Car />} />
        <Route path='/competition' element={<Competition />} />
        <Route path='/support' element={<Support />} />
        <Route path='/social' element={<Social />} />
      </Routes>
    </MantineProvider>
  );
}

export default App;