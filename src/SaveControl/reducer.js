import {transformFromServer} from '../utils';
import {
  SAVE_SUCCESS,
  SAVE_REPEAT,
  SAVE_CREATE_DIFF,
  SAVE_START,
  SAVE_DIFF
} from './actions';
import {
  TABLE_EDITOR_LOAD_SUCCESS,
  TABLE_EDITOR_SET_TEXT,
  TABLE_EDITOR_ROW_ADD_DEFAULT_ID,
  TABLE_EDITOR_ROW_ADD_ID,
  TABLE_EDITOR_SET_IMAGES,
  TABLE_EDITOR_ROW_ADD,
  TABLE_EDITOR_ROW_COPY,
  TABLE_EDITOR_ROW_COPY_SUCCESS,
  TABLE_EDITOR_CELL_SELECT_END
} from '../Table/actions';
import rows from '../Table/rowReducer';

const initialState = {
  isSave: false,
  isError: false,
  prevState: [],
  isProgress: false,
  fetchDiff: false,
  waitingState: [],
  saveState: []
};

export default function (state = initialState, action) {
  switch (action.type) {
    case TABLE_EDITOR_LOAD_SUCCESS:
      return {
        ...state,
        prevState: [...action.payload.rows]
      };

    case SAVE_REPEAT:
    case TABLE_EDITOR_SET_TEXT:
    case TABLE_EDITOR_SET_IMAGES:
    case TABLE_EDITOR_ROW_ADD:
    case TABLE_EDITOR_CELL_SELECT_END:
    case 'HISTORY_PREV':
    case 'HISTORY_NEXT':
      return {
        ...state,
        isSave: true
      };

    case TABLE_EDITOR_ROW_COPY: {
      const targetId = action.payload.target && action.payload.target.check.common.id;

      if (targetId < 0) {
        return state;
      }

      const tmpWaitingState = [...state.waitingState];
      const tmpWaitingItemIndex = tmpWaitingState.findIndex(item => item.id === targetId);

      if (tmpWaitingItemIndex !== -1) {
        tmpWaitingState[tmpWaitingItemIndex] = {...tmpWaitingState[tmpWaitingItemIndex], copy: true};
      } else {
        tmpWaitingState.push({id: targetId, copy: true});
      }

      return {
        ...state,
        waitingState: tmpWaitingState,
        isSave: true
      };
    }

    case TABLE_EDITOR_ROW_COPY_SUCCESS: {
      const newPrevState = [...state.prevState];
      action.payload.rows.forEach((item) => {
        const target = newPrevState.findIndex(newPrevStateItem => newPrevStateItem.check.common.id === item.id);

        if (target > -1) {
          newPrevState.push(transformFromServer(item.copy.columns, action.payload.new_row));
        }
      });

      return {
        ...state,
        prevState: newPrevState
      };
    }

    case SAVE_CREATE_DIFF:
      return {
        ...state,
        fetchDiff: true,
        isSave: false,
      };

    case SAVE_DIFF:
      return {
        ...state,
        waitingState: action.payload.waitingState,
        fetchDiff: false,
        prevState: action.payload.prevState
      };

    case SAVE_START: {
      const saveState = [];
      const waitingState = [];

      state.waitingState.forEach((row) => {
        const columns = row.columns;

        if (columns) {
          const tmpColumns = {...columns};
          const tmpRow = {...row, columns: tmpColumns};

          if (row.id > 0 && tmpColumns.product_group) {
            delete tmpColumns.product_group;
            if (!Object.keys(tmpColumns).length) {
              return;
            }
          }

          if (tmpColumns.product_group && tmpColumns.product_group.parent_id < 0) {
            waitingState.push(tmpRow);
          } else {
            saveState.push(tmpRow);
          }
        } else {
          saveState.push(row);
        }
      });

      return {
        ...state,
        saveState,
        waitingState,
        isProgress: true,
        isError: false
      };
    }

    case TABLE_EDITOR_ROW_ADD_DEFAULT_ID:
    case TABLE_EDITOR_ROW_ADD_ID: {
      const tmpWaitingState = state.waitingState.map((row) => {
        const payloadItem = action.payload.find(payloadRow => row.id === payloadRow.id);
        const payloadChildItem = action.payload.find(payloadRow =>
          row.columns.product_group && row.columns.product_group.parent_id === payloadRow.id);

        if (payloadItem) {
          return {
            ...row,
            id: payloadItem.record_id
          };
        }

        if (payloadChildItem) {
          return {
            ...row,
            columns: {
              ...row.columns,
              product_group: {
                parent_id: payloadChildItem.record_id
              }
            }
          };
        }

        return row;
      });

      return {
        ...state,
        waitingState: tmpWaitingState,
        prevState: rows(state.prevState, action)
      };
    }

    case SAVE_SUCCESS: {
      if (!action.payload.error) {
        return {
          ...state,
          saveState: [],
          isProgress: false,
        };
      }

      const saveState = state.saveState;

      state.waitingState.forEach((record) => {
        const saveItem = saveState.find(item => item.id === record.id);

        if (saveItem) {
          if (saveItem.destroy && !record.destroy) {
            delete saveItem.destroy;
          }

          Object.keys(record).forEach((key) => {
            if (typeof record[key] === 'object' && record[key] !== null) {
              saveItem[key] = {...saveItem[key], ...record[key]};
            } else {
              saveItem[key] = record[key];
            }
          });
        } else {
          saveState.push(record);
        }
      });

      return {
        ...state,
        saveState: [],
        waitingState: saveState,
        isProgress: false,
        isSave: true,
        isError: true
      };
    }

    default:
      return state;
  }
}
