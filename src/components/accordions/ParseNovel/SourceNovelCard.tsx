import React, { ReactNode } from 'react';
import { Plugin } from '@typings/plugin';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  ListItem,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import CopiableItem from '@components/CopiableItem';
import PathItem from '@components/PathItem';

const FlexRow = ({ children }: { children: ReactNode }) => (
  <Stack direction="row" gap={1} sx={{ alignItems: 'center' }}>
    {children}
  </Stack>
);

export default function SourceNovelCard({
  sourceNovel,
}: {
  sourceNovel: Plugin.SourceNovel;
}) {
  return (
    <Box sx={{ display: 'flex', p: 1, width: '100%', textAlign: 'left' }}>
      <CopiableItem content={sourceNovel.cover}>
        <Tooltip title={sourceNovel.cover}>
          <CardMedia
            component="img"
            sx={{ width: 300, height: 400, objectFit: 'cover' }}
            image={sourceNovel.cover}
          />
        </Tooltip>
      </CopiableItem>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <CardContent>
          <Tooltip title={sourceNovel.name}>
            <Box>
              <CopiableItem content={sourceNovel.name}>
                <Button variant="outlined">
                  <Typography
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: '5',
                      WebkitBoxOrient: 'vertical',
                      fontSize: 14,
                    }}
                  >
                    {sourceNovel.name}
                  </Typography>
                </Button>
              </CopiableItem>
            </Box>
          </Tooltip>
        </CardContent>
        <CardContent>
          <FlexRow>
            <Typography sx={{ width: 50 }}>Status:</Typography>
            <Chip variant="outlined" label={sourceNovel.status} color="info" />
          </FlexRow>
          <FlexRow>
            <Typography sx={{ width: 50 }}>Author:</Typography>
            <Chip variant="outlined" label={sourceNovel.author} color="info" />
          </FlexRow>
          <FlexRow>
            <Typography sx={{ width: 50 }}>Artist: </Typography>
            <Chip variant="outlined" label={sourceNovel.artist} color="info" />
          </FlexRow>
        </CardContent>
        <CardContent sx={{ width: '50%' }}>
          <PathItem path={sourceNovel.path} />
        </CardContent>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <CardContent>
          <Typography>Genres</Typography>
          <Box
            sx={{
              width: 600,
              overflowX: 'auto',
            }}
          >
            <Stack sx={{ width: 'max-content' }} direction={'row'}>
              {sourceNovel.genres?.split(/,\s*/).map((genre, index) => (
                <ListItem key={'genre_' + index}>
                  <Chip label={genre} />
                </ListItem>
              ))}
            </Stack>
          </Box>
        </CardContent>
        <CardContent>
          <Typography>Summary</Typography>
          <Typography
            sx={{
              overflowY: 'auto',
              height: 300,
              p: 2,
              borderRadius: 2,
              backgroundColor: 'rgba(0,0,0,0.1)',
            }}
          >
            {sourceNovel.summary}
          </Typography>
        </CardContent>
      </Box>
    </Box>
  );
}
