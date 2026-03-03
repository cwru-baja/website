import { useState, useEffect } from 'react';
import { Burger, Container, Group, Drawer, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import classes from './HeaderSimple.module.css';
import logo from '../../assets/logo/team/cwru-motorsports-white-no-text-logo.png';

const links = [
    { link: '/', label: 'Home' },
    { link: '/team', label: 'Team' },
    { link: '/car', label: 'Car' },
    { link: '/competition', label: 'Competition' },
    { link: '/support', label: 'Support' },
    { link: '/social', label: 'Social' }
];

export function HeaderSimple() {
    const [opened, { toggle, close }] = useDisclosure(false);
    const location = useLocation();
    const [active, setActive] = useState(location.pathname);
    const navigate = useNavigate();

    useEffect(() => {
        setActive(location.pathname);
    }, [location.pathname]);

    const items = links.map((link) => (
        <a
            key={link.label}
            href={link.link}
            className={classes.link}
            data-active={active === link.link || undefined}
            onClick={(event) => {
                event.preventDefault();
                setActive(link.link);
                navigate(link.link);
                close();
            }}
        >
            {link.label}
        </a>
    ));

    const drawerItems = links.map((link) => (
        <a
            key={link.label}
            href={link.link}
            className={`${classes.link} ${classes.drawerLink}`}
            data-active={active === link.link || undefined}
            onClick={(event) => {
                event.preventDefault();
                setActive(link.link);
                navigate(link.link);
                close();
            }}
        >
            {link.label}
        </a>
    ));

    return (
        <header className={classes.header}>
            <Container size="xl" className={classes.inner}>
                <div
                    className={classes.logoContainer}
                    onClick={() => {
                        navigate('/');
                        setActive('/');
                        close();
                    }}
                >
                    <img src={logo} alt="Logo" className={classes.logo} />
                </div>
                <Group gap={5} visibleFrom="xs">
                    {items}
                </Group>
                <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />

                <Drawer
                    opened={opened}
                    onClose={close}
                    position="right"
                    hiddenFrom="xs"
                    title="Navigation"
                    padding="md"
                    size="md"
                >
                    <Stack className={classes.drawerStack}>
                        {drawerItems}
                    </Stack>
                </Drawer>
            </Container>
        </header>
    );
}
