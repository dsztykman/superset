/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { t } from '@superset-ui/core';
import { filter } from 'lodash';
import {
  useListViewResource,
  useChartEditModal,
  useFavoriteStatus,
} from 'src/views/CRUD/hooks';
import {
  setInLocalStorage,
  getFromLocalStorage,
} from 'src/utils/localStorageHelpers';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { useHistory } from 'react-router-dom';
import { TableTabTypes } from 'src/views/CRUD/types';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import { User } from 'src/types/bootstrapTypes';
import { CardContainer } from 'src/views/CRUD/utils';
import { HOMEPAGE_CHART_FILTER } from 'src/views/CRUD/storageKeys';
import ChartCard from 'src/views/CRUD/chart/ChartCard';
import Chart from 'src/types/Chart';
import handleResourceExport from 'src/utils/export';
import Loading from 'src/components/Loading';
import ErrorBoundary from 'src/components/ErrorBoundary';
import SubMenu from 'src/components/Menu/SubMenu';
import EmptyState from './EmptyState';

const PAGE_SIZE = 3;

interface ChartTableProps {
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  search: string;
  chartFilter?: string;
  user?: User;
  mine: Array<any>;
  showThumbnails: boolean;
  examples?: Array<object>;
}

function ChartTable({
  user,
  addDangerToast,
  addSuccessToast,
  mine,
  showThumbnails,
  examples,
}: ChartTableProps) {
  const history = useHistory();
  const filterStore = getFromLocalStorage(HOMEPAGE_CHART_FILTER, null);
  let initialFilter = filterStore || TableTabTypes.EXAMPLES;

  if (!examples && filterStore === TableTabTypes.EXAMPLES) {
    initialFilter = TableTabTypes.MINE;
  }

  const filteredExamples = filter(examples, obj => 'viz_type' in obj);

  const {
    state: { loading, resourceCollection: charts, bulkSelectEnabled },
    setResourceCollection: setCharts,
    hasPerm,
    refreshData,
    fetchData,
  } = useListViewResource<Chart>(
    'chart',
    t('chart'),
    addDangerToast,
    true,
    initialFilter === 'Mine' ? mine : filteredExamples,
    [],
    false,
  );

  const chartIds = useMemo(() => charts.map(c => c.id), [charts]);
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'chart',
    chartIds,
    addDangerToast,
  );
  const {
    sliceCurrentlyEditing,
    openChartEditModal,
    handleChartUpdated,
    closeChartEditModal,
  } = useChartEditModal(setCharts, charts);

  const [chartFilter, setChartFilter] = useState(initialFilter);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (loaded || chartFilter === 'Favorite') {
      getData(chartFilter);
    }
    setLoaded(true);
  }, [chartFilter]);

  const handleBulkChartExport = (chartsToExport: Chart[]) => {
    const ids = chartsToExport.map(({ id }) => id);
    handleResourceExport('chart', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const getFilters = (filterName: string) => {
    const filters = [];

    if (filterName === 'Mine') {
      filters.push({
        id: 'created_by',
        operator: 'rel_o_m',
        value: `${user?.userId}`,
      });
    } else if (filterName === 'Favorite') {
      filters.push({
        id: 'id',
        operator: 'chart_is_favorite',
        value: true,
      });
    }
    return filters;
  };

  const menuTabs = [
    {
      name: 'Favorite',
      label: t('Favorite'),
      onClick: () => {
        setChartFilter(TableTabTypes.FAVORITE);
        setInLocalStorage(HOMEPAGE_CHART_FILTER, TableTabTypes.FAVORITE);
      },
    },
    {
      name: 'Mine',
      label: t('Mine'),
      onClick: () => {
        setChartFilter(TableTabTypes.MINE);
        setInLocalStorage(HOMEPAGE_CHART_FILTER, TableTabTypes.MINE);
      },
    },
  ];

  if (examples) {
    menuTabs.push({
      name: 'Examples',
      label: t('Examples'),
      onClick: () => {
        setChartFilter(TableTabTypes.EXAMPLES);
        setInLocalStorage(HOMEPAGE_CHART_FILTER, TableTabTypes.EXAMPLES);
      },
    });
  }

  const getData = (filter: string) =>
    fetchData({
      pageIndex: 0,
      pageSize: PAGE_SIZE,
      sortBy: [
        {
          id: 'changed_on_delta_humanized',
          desc: true,
        },
      ],
      filters: getFilters(filter),
    });

  if (loading) return <Loading position="inline" />;
  return (
    <ErrorBoundary>
      {sliceCurrentlyEditing && (
        <PropertiesModal
          onHide={closeChartEditModal}
          onSave={handleChartUpdated}
          show
          slice={sliceCurrentlyEditing}
        />
      )}

      <SubMenu
        activeChild={chartFilter}
        // eslint-disable-next-line react/no-children-prop
        tabs={menuTabs}
        buttons={[
          {
            name: (
              <>
                <i className="fa fa-plus" />
                {t('Chart')}
              </>
            ),
            buttonStyle: 'tertiary',
            onClick: () => {
              window.location.assign('/chart/add');
            },
          },
          {
            name: 'View All »',
            buttonStyle: 'link',
            onClick: () => {
              const target =
                chartFilter === 'Favorite'
                  ? '/chart/list/?filters=(favorite:!t)'
                  : '/chart/list/';
              history.push(target);
            },
          },
        ]}
      />
      {charts?.length ? (
        <CardContainer>
          {charts.map(e => (
            <ChartCard
              key={`${e.id}`}
              openChartEditModal={openChartEditModal}
              chartFilter={chartFilter}
              chart={e}
              userId={user?.userId}
              hasPerm={hasPerm}
              showThumbnails={showThumbnails}
              bulkSelectEnabled={bulkSelectEnabled}
              refreshData={refreshData}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              favoriteStatus={favoriteStatus[e.id]}
              saveFavoriteStatus={saveFavoriteStatus}
              handleBulkChartExport={handleBulkChartExport}
            />
          ))}
        </CardContainer>
      ) : (
        <EmptyState tableName="CHARTS" tab={chartFilter} />
      )}
      {preparingExport && <Loading />}
    </ErrorBoundary>
  );
}

export default withToasts(ChartTable);
