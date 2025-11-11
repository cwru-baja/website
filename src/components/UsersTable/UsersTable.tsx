import { Anchor, Badge, Group, Table, Text } from '@mantine/core';
import styles from './UsersTable.module.css';
import { useState } from 'react';

const jobColors: Record<string, string> = {
    'Systems': 'blue',
    'CNC': 'green',
    'Brakes': 'red',
    'Manufacturing': 'yellow',
    'Test Engineering': 'brown',
    'Drivetrain': 'cyan',
    'Frame': 'orange',
    'Suspension': 'teal',
    'Design': 'gray',
    'Business Presentation': 'purple'
};

interface UserDataType {
    name: string;
    subteams: string[];
    classOf: string;
    major: string;
}

const data: UserDataType[] = [
    { name: 'Abra Giddings', subteams: ['Systems', 'Test Engineering'], classOf: '2028', major: 'Computer Engineering & Computer Science' },
    { name: 'Abraham Loren', subteams: ['CNC'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'AJ Williams', subteams: ['Frame', 'Drivetrain'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Arka Nath', subteams: ['Brakes'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Aryeh Rothenberg', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Avaneesh Rao', subteams: ['Brakes', 'Suspension'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Ben Roy', subteams: ['Test Engineering'], classOf: '2027', major: 'Electrical Engineering' },
    { name: 'Cameron Griffith', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Ciaran Nimick', subteams: ['Test Engineering'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Cole Smith', subteams: ['Systems'], classOf: '2026', major: 'Electrical Engineering' },
    { name: 'Daniel de Dios Molina', subteams: ['Test Engineering'], classOf: '2028', major: 'Mechanical & Aerospace Engineering' },
    { name: 'David Kaplan', subteams: ['Drivetrain'], classOf: '2028', major: 'Mechanical Engineering' },
    //{ name: 'Eladov Kleinerman', subteams: ['CNC'], classOf: '2027', major: 'Mechanical Engineering' },
    //{ name: 'Evan Grover', subteams: ['Systems'], classOf: '2026', major: 'Electrical Engineering' },
    { name: 'Evan Zhou', subteams: ['Manufacturing'], classOf: '2028', major: 'Electrical Engineering' },
    { name: 'Finn Barrett', subteams: ['Manufacturing'], classOf: '2028', major: 'Mechanical Engineering' },
    //{ name: 'Giovanni Ricupero', subteams: ['Suspension'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'Isaac Hugenberger', subteams: ['Design'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Jack Fink', subteams: ['Manufacturing'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Jake Meltzer', subteams: ['Manufacturing'], classOf: '2028', major: 'Astronomy' },
    { name: 'James Evans', subteams: ['Manufacturing'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'Jesse Nevling', subteams: ['Drivetrain'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Jonah Keller', subteams: ['Manufacturing'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'Jonah Lorenzo', subteams: ['Systems'], classOf: '2026', major: 'Computer Science' },
    { name: 'Karthik Rajasekar', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Kyle Rosenbaum', subteams: ['Manufacturing'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'Zach Wolf', subteams: ['Manufacturing'], classOf: '2028', major: 'Mechanical Engineering' },
    //{ name: 'Zane Sandelin', subteams: ['Drivetrain'], classOf: '2028', major: 'Mechanical Engineering' },
    //{ name: 'Suhani Dangre', subteams: ['Drivetrain', 'Business Presentation'], classOf: '2028', major: 'Materials Science & Engineering' },
    //{ name: 'Maureen Manning', subteams: ['Manufacturing'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Laith Wattar', subteams: ['Suspension'], classOf: '2026', major: 'Mechanical Engineering' },
    //{ name: 'Logan Senning', subteams: ['Test Engineering'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Lucas Powell', subteams: ['Manufacturing'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'McKenzie Roman', subteams: ['Drivetrain'], classOf: '2026', major: 'Mechanical Engineering' },
    //{ name: 'Matthew Alcantara', subteams: ['Drivetrain'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Morgan Ernst', subteams: ['Business Presentation'], classOf: '2028', major: 'Materials Science & Engineering' },
    { name: 'Nathan Fenster', subteams: ['Frame'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Neel Mani Sulkunte', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Nick Bulawa', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Niranjan Girish', subteams: ['Systems'], classOf: '2027', major: 'Computer & Electrical Engineering' },
    { name: 'Sai Charmitha Yelampalli', subteams: ['Business Presentation', 'Systems'], classOf: '2027', major: 'Biomedical Engineering (Pre-med)' },
    { name: 'Sai Subramanian', subteams: ['Systems'], classOf: '2027', major: 'Electrical Engineering' },
    { name: 'Steven Chen', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
    { name: 'Thomas Murphy', subteams: ['Manufacturing'], classOf: '2026', major: 'Mechanical Engineering' },
    { name: 'Veronica Talan', subteams: ['Drivetrain', 'Manufacturing'], classOf: '2028', major: 'Biomedical Engineering (Pre-med)' },
    //{ name: 'William MacCormack', subteams: ['Systems'], classOf: '2025', major: 'Aerospace Engineering' },
    //{ name: 'Zach Brown', subteams: ['Systems'], classOf: '2025', major: 'Electrical Engineering' },
    { name: 'Zhansar Zhaparov', subteams: ['Manufacturing'], classOf: '2028', major: 'Mechanical Engineering' },
    { name: 'Ana Newton', subteams: ['Manufacturing'], classOf: '2027', major: 'Mechanical Engineering' },
];

type SortField = 'name' | 'classOf' | null;
type SortDirection = 'asc' | 'desc';

export function UsersTable() {
    const [sortField, setSortField] = useState<SortField>('classOf');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            // Toggle direction if same field is clicked
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New field, set to ascending
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortField) return 0;
        
        const valueA = a[sortField];
        const valueB = b[sortField];
        
        if (sortDirection === 'asc') {
            return valueA.localeCompare(valueB);
        } else {
            return valueB.localeCompare(valueA);
        }
    });

    const getSortIcon = (field: SortField) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? ' ▲' : ' ▼';
    };

    const rows = sortedData.map((item) => (
        <Table.Tr key={item.name} className={styles.tableRow}>
            <Table.Td className={`${styles.tableCell} ${styles.nameColumn}`}>
                <Group gap="sm">
                    <Text fz="sm" fw={500}>{item.name}</Text>
                </Group>
            </Table.Td>
            <Table.Td className={`${styles.tableCell} ${styles.subteamColumn}`}>
                <Group gap="xs">
                    {item.subteams.map((subteam) => (
                        <Badge
                            key={subteam}
                            color={jobColors[subteam] || 'gray'}
                            variant="light"
                        >
                            {subteam}
                        </Badge>
                    ))}
                </Group>
            </Table.Td>
            <Table.Td className={`${styles.tableCell} ${styles.classColumn}`}>
                <Anchor component="button" size="sm">{item.classOf}</Anchor>
            </Table.Td>
            <Table.Td className={`${styles.tableCell} ${styles.majorColumn}`}>
                <Text fz="sm">{item.major}</Text>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <div className={styles.tableContainer}>
            <Table className={styles.table} verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th 
                            className={`${styles.nameColumn} ${styles.sortableHeader}`}
                            onClick={() => handleSort('name')}
                        >
                            Student{getSortIcon('name')}
                        </Table.Th>
                        <Table.Th className={styles.subteamColumn}>Subteam</Table.Th>
                        <Table.Th 
                            className={`${styles.classColumn} ${styles.sortableHeader}`}
                            onClick={() => handleSort('classOf')}
                        >
                            Class Of{getSortIcon('classOf')}
                        </Table.Th>
                        <Table.Th className={styles.majorColumn}>Major</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
            </Table>
        </div>
    );
}