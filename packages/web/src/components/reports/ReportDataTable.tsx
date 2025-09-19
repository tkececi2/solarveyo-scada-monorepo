import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { 
  TableChart, 
  ArrowUpward, 
  ArrowDownward,
  WbSunny,
} from '@mui/icons-material';

interface ReportDataRow {
  date: string;
  totalProduction: number;
  averagePower: number;
  activeSites: number;
  totalSites: number;
  efficiency?: number;
}

interface ReportDataTableProps {
  data: ReportDataRow[];
  title?: string;
}

type SortDirection = 'asc' | 'desc';
type SortField = 'date' | 'totalProduction' | 'averagePower' | 'efficiency';

export default function ReportDataTable({ 
  data, 
  title = 'Detaylı Üretim Verileri' 
}: ReportDataTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField] || 0;
    const bValue = b[sortField] || 0;
    
    if (sortField === 'date') {
      return sortDirection === 'asc' 
        ? new Date(aValue).getTime() - new Date(bValue).getTime()
        : new Date(bValue).getTime() - new Date(aValue).getTime();
    }
    
    const aNum = Number(aValue);
    const bNum = Number(bValue);
    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
  });

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TableChart sx={{ mr: 1 }} color="primary" />
          <Typography variant="h6">{title}</Typography>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => handleSort('date')}
                  >
                    Tarih
                    <SortIcon field="date" />
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer' }}
                    onClick={() => handleSort('totalProduction')}
                  >
                    Üretim (MWh)
                    <SortIcon field="totalProduction" />
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer' }}
                    onClick={() => handleSort('averagePower')}
                  >
                    Ort. Güç (MW)
                    <SortIcon field="averagePower" />
                  </Box>
                </TableCell>
                <TableCell align="center">Aktif Santral</TableCell>
                <TableCell align="right">
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', cursor: 'pointer' }}
                    onClick={() => handleSort('efficiency')}
                  >
                    Verim
                    <SortIcon field="efficiency" />
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(row.date).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                      {(row.totalProduction / 1000).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {(row.averagePower / 1000).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={<WbSunny sx={{ fontSize: 16 }} />}
                      label={`${row.activeSites} / ${row.totalSites}`}
                      size="small"
                      color={row.activeSites === row.totalSites ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {row.efficiency && (
                      <Tooltip title={`%${row.efficiency.toFixed(1)} verimlilik`}>
                        <Chip
                          label={`%${row.efficiency.toFixed(1)}`}
                          size="small"
                          color={row.efficiency > 80 ? 'success' : row.efficiency > 60 ? 'warning' : 'error'}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={data.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Sayfa başına:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </CardContent>
    </Card>
  );
}
